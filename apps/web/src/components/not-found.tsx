import { Button } from '@attentionawareness/ui';
import { m } from '../paraglide/messages.js';
import { PageColumn, PageFoot, PageHeader, PageRoot } from './page.tsx';

/**
 * What a path the site does not have answers with. The server still sends it
 * as a 404, so it is a page for the reader and nothing for a crawler to keep.
 */
export function NotFound() {
  return (
    <PageRoot>
      <PageHeader centered fill title={m.not_found_title()}>
        <div>
          <Button render={<a href="/" />} variant="outline">
            {m.not_found_home()}
          </Button>
        </div>
      </PageHeader>
      <PageColumn width="wide">
        <PageFoot />
      </PageColumn>
    </PageRoot>
  );
}
