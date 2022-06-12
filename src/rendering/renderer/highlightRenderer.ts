import { Environment } from 'nunjucks';
import dateFilter from 'nunjucks-date-filter';

import highlightTemplateWrapper from '~/rendering//templates/highlightTemplateWrapper.njk';
import { BlockReferenceExtension } from '../nunjucks.extensions';
import { trimMultipleLines, generateAppLink } from '../utils';
import type { Highlight, HighlightRenderTemplate } from '~/models';

export const HighlightIdBlockRefPrefix = '^ref-';

dateFilter.setDefaultFormat('DD-MM-YYYY');

export default class HighlightRenderer {
  private nunjucks: Environment;

  constructor(private template: string) {
    this.nunjucks = new Environment(null, { autoescape: false });
    this.nunjucks.addExtension('BlockRef', new BlockReferenceExtension());
    this.nunjucks.addFilter('date', dateFilter);
  }

  public validate(template: string): boolean {
    try {
      this.nunjucks.renderString(template, { text: '' });
      return true;
    } catch (error) {
      return false;
    }
  }

  public render(highlight: Highlight, bookAsin: string = undefined): string {
    const highlightParams: HighlightRenderTemplate = {
      ...highlight,
      appLink: generateAppLink(bookAsin, highlight),
    };

    const highlightTemplate = highlightTemplateWrapper.replace('{{ content }}', this.template);

    const renderedHighlight = this.nunjucks.renderString(highlightTemplate, highlightParams);

    return trimMultipleLines(renderedHighlight);
  }
}
