import _ from 'lodash';
import { App, PluginSettingTab, Setting } from 'obsidian';
import { get } from 'svelte/store';

import { ee } from '~/eventEmitter';
import AmazonLogoutModal from '~/components/amazonLogoutModal';
import type KindlePlugin from '~/.';
import type FileManager from '~/fileManager';
import type { AmazonAccountRegion } from '~/models';
import { Renderer } from '~/renderer';
import { settingsStore } from '~/store';
import { scrapeLogoutUrl } from '~/scraper';
import { AmazonRegions } from '~/amazonRegion';

const { moment } = window;

export class SettingsTab extends PluginSettingTab {
  private renderer: Renderer;

  constructor(app: App, plugin: KindlePlugin, private fileManager: FileManager) {
    super(app, plugin);
    this.app = app;
    this.renderer = new Renderer();
  }

  public async display(): Promise<void> {
    const { containerEl } = this;

    containerEl.empty();

    if (get(settingsStore).isLoggedIn) {
      await this.logout();
    }

    this.highlightsFolder();
    this.downloadBookMetadata();
    this.syncOnBoot();
    this.highlightTemplate();
    this.amazonRegion();
    this.resetSyncHistory();
  }

  private async logout(): Promise<void> {
    const syncMessage = get(settingsStore).lastSyncDate
      ? `Last sync ${moment(get(settingsStore).lastSyncDate).fromNow()}`
      : 'Sync has never run';

    const kindleFiles = await this.fileManager.getKindleFiles();

    const descFragment = document.createRange().createContextualFragment(`
      ${kindleFiles.length} book(s) synced<br/>
      ${syncMessage}
    `);

    new Setting(this.containerEl)
      .setName('Logged in to Amazon Kindle Reader')
      .setDesc(descFragment)
      .addButton((button) => {
        return button
          .setButtonText('Sign out')
          .setCta()
          .onClick(async () => {
            button.removeCta().setButtonText('Signing out...').setDisabled(true);

            ee.emit('startLogout');

            try {
              const signout = await scrapeLogoutUrl();

              // User is still logged in
              if (signout.isStillLoggedIn) {
                const modal = new AmazonLogoutModal(signout.url);
                await modal.doLogout();
              }

              await settingsStore.actions.logout();
            } catch (error) {
              ee.emit('logoutFailure');
            }

            ee.emit('logoutSuccess');

            this.display(); // rerender
          });
      });
  }

  private amazonRegion(): void {
    new Setting(this.containerEl)
      .setName('Amazon region')
      .setDesc(
        "Amazon's kindle reader is region specific. Choose your preferred country/region which has your highlights"
      )
      .addDropdown((dropdown) => {
        Object.keys(AmazonRegions).forEach((region: AmazonAccountRegion) => {
          const account = AmazonRegions[region];
          dropdown.addOption(region, `${account.name} (${account.hostname})`);
        });

        return dropdown
          .setValue(get(settingsStore).amazonRegion)
          .onChange(async (value: AmazonAccountRegion) => {
            await settingsStore.actions.setAmazonRegion(value);
          });
      });
  }

  private highlightsFolder(): void {
    new Setting(this.containerEl)
      .setName('Highlights folder location')
      .setDesc('Vault folder to use for writing book highlight notes')
      .addDropdown((dropdown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const files = (this.app.vault.adapter as any).files;
        const folders = _.pickBy(files, (val) => {
          return val.type === 'folder';
        });

        Object.keys(folders).forEach((val) => {
          dropdown.addOption(val, val);
        });
        return dropdown
          .setValue(get(settingsStore).highlightsFolder)
          .onChange(async (value) => {
            await settingsStore.actions.setHighlightsFolder(value);
          });
      });
  }

  private highlightTemplate(): void {
    new Setting(this.containerEl)
      .setName('Highlight template')
      .setDesc('Template for an individual highlight')
      .addTextArea((text) => {
        text.inputEl.style.width = '100%';
        text.inputEl.style.height = '450px';
        text.inputEl.style.fontSize = '0.8em';
        text.inputEl.placeholder = this.renderer.defaultHighlightTemplate();
        text.setValue(get(settingsStore).highlightTemplate).onChange(async (value) => {
          const isValid = this.renderer.validate(value);

          if (isValid) {
            await settingsStore.actions.setHighlightTemplate(value);
          }

          text.inputEl.style.border = isValid ? '' : '1px solid red';
        });
        return text;
      });
  }

  private downloadBookMetadata(): void {
    new Setting(this.containerEl)
      .setName('Download book metadata')
      .setDesc(
        'Download extra book metadata from Amazon.com (Amazon sync only). Switch off to speed sync'
      )
      .addToggle((toggle) =>
        toggle.setValue(get(settingsStore).downloadBookMetadata).onChange(async (value) => {
          await settingsStore.actions.setDownloadBookMetadata(value);
        })
      );
  }

  private syncOnBoot(): void {
    new Setting(this.containerEl)
      .setName('Sync on Startup')
      .setDesc(
        'Automatically sync new Kindle highlights when Obsidian starts  (Amazon sync only)'
      )
      .addToggle((toggle) =>
        toggle.setValue(get(settingsStore).syncOnBoot).onChange(async (value) => {
          await settingsStore.actions.setSyncOnBoot(value);
        })
      );
  }

  private resetSyncHistory(): void {
    new Setting(this.containerEl)
      .setName('Reset sync')
      .setDesc('Wipe sync history to allow for resync')
      .addButton((button) => {
        return button
          .setButtonText('Reset')
          .setWarning()
          .onClick(async () => {
            await settingsStore.actions.resetSyncHistory();
            this.display(); // rerender
          });
      });
  }
}
