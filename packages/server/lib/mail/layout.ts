/*
 * The shell every Fisherfeed email is built in.
 *
 * Mail is not the web. There is no flexbox worth relying on, no external
 * stylesheet, no custom font that Outlook will honour and no JavaScript, so
 * this is tables, inline styles and one <style> block that only carries the
 * dark mode overrides and the small screen rule. Everything that matters is
 * inline, so a client that throws the block away still gets the right mail.
 *
 * The house rules still hold: zero border radius, League Gothic for the
 * display line with a real condensed fallback for the clients that have never
 * heard of it, Jost falling back to the system sans, teal used once per mail
 * and never as decoration.
 */

/* The product's own tokens, as literals because a mail cannot read a stylesheet. */
const INK = '#0b0909';
const INK_2 = '#55504b';
const INK_3 = '#8d867f';
const PAPER = '#f4f1ec';
const WHITE = '#ffffff';
const TEAL = '#34adbd';
const TEAL_INK = '#062a2f';
const LINE = '#e0dbd4';

/*
 * The mark, absolute: a mail has no origin to be relative to. This is the
 * app's own file, light lines on transparent drawn for a black ground, which
 * is what the band behind it is in both light and dark mail. Alt is empty on
 * purpose: the wordmark beside it already says the name, so a client with
 * images off reads "Fisherfeed" once rather than twice.
 */
const MARK = 'https://fisherfeed.com/brand/fisherfeed-mark.png';

/*
 * League Gothic is not installed on anybody's phone, so the stack falls
 * through the condensed faces that ship with Windows and macOS before it gives
 * up and takes Arial. The letter spacing and the uppercase are what carry the
 * look when it does.
 */
const DISPLAY =
   "'League Gothic', 'Haettenschweiler', 'Arial Narrow', Impact, 'Helvetica Neue', Arial, sans-serif";
const SANS = "'Jost', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export type MailContent = {
   /* The line the inbox shows beside the subject. Never left to chance. */
   preheader: string;
   kicker: string;
   heading: string;
   /* One string per paragraph. */
   body: string[];
   button?: { label: string; url: string };
   /* The line above the pasteable link, for anyone whose client eats buttons. */
   linkNote?: string;
   /* The small print at the foot: what to do if this was not you. */
   footnote?: string[];
};

const escape = (value: string) =>
   value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

/*
 * Outlook on Windows renders a table cell's background but ignores padding on
 * an anchor, so the button is a cell with the link stretched across it and a
 * VML rectangle behind it for the Word rendering engine.
 */
function button(label: string, url: string) {
   const safeUrl = escape(url);
   return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
         <tr>
            <td align="center" bgcolor="${TEAL}" style="background:${TEAL};">
               <!--[if mso]>
               <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fillcolor="${TEAL}" stroked="f" style="width:260px;height:48px;">
               <v:textbox inset="0,0,0,0"><center style="color:${TEAL_INK};font-family:Arial,sans-serif;font-size:17px;">
               <![endif]-->
               <a href="${safeUrl}" style="display:inline-block;padding:15px 30px;font-family:${DISPLAY};font-size:20px;line-height:20px;letter-spacing:0.08em;text-transform:uppercase;color:${TEAL_INK};text-decoration:none;">${escape(label)}</a>
               <!--[if mso]>
               </center></v:textbox></v:rect>
               <![endif]-->
            </td>
         </tr>
      </table>`;
}

export function renderEmail(content: MailContent): {
   html: string;
   text: string;
} {
   const paragraphs = content.body
      .map(
         (line) =>
            `<p style="margin:0 0 14px;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK};" class="ink">${escape(line)}</p>`
      )
      .join('');

   const footnotes = (content.footnote ?? [])
      .map(
         (line) =>
            `<p style="margin:0 0 8px;font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_2};" class="ink-2">${escape(line)}</p>`
      )
      .join('');

   const link = content.button
      ? `
         <p style="margin:18px 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${INK_2};" class="ink-2">${escape(content.linkNote ?? 'Or paste this into your browser:')}</p>
         <p style="margin:4px 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${TEAL_INK};word-break:break-all;" class="ink-2"><a href="${escape(content.button.url)}" style="color:#17727f;text-decoration:underline;">${escape(content.button.url)}</a></p>`
      : '';

   const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>${escape(content.heading)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .page { background:${INK} !important; }
    .card { background:#151212 !important; }
    .ink { color:${PAPER} !important; }
    .ink-2 { color:#b8b2ab !important; }
    .rule { border-color:rgba(244,241,236,0.18) !important; }
    /* The pasteable link is teal on paper, which is too dark to read on a
       black ground. The night value of the same token. */
    .card a { color:#5fc6d3 !important; }
  }
  @media only screen and (max-width:620px) {
    .pad { padding-left:22px !important; padding-right:22px !important; }
    .display { font-size:34px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAPER};" class="page">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${PAPER};">${escape(content.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};" class="page">
  <tr>
    <td align="center" style="padding:28px 12px 40px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;">

        <tr>
          <td bgcolor="${INK}" style="background:${INK};padding:20px 34px;border-bottom:3px solid ${TEAL};" class="pad">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="padding-right:12px;line-height:0;" valign="middle"><img src="${MARK}" width="40" height="40" alt="" style="display:block;border:0;outline:none;width:40px;height:40px;"></td>
              <td valign="middle"><span style="font-family:${DISPLAY};font-size:26px;line-height:26px;letter-spacing:0.1em;text-transform:uppercase;color:${PAPER};">Fisherfeed</span></td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td bgcolor="${WHITE}" style="background:${WHITE};padding:34px;" class="card pad">
            <p style="margin:0 0 10px;font-family:${SANS};font-size:12px;line-height:16px;letter-spacing:0.16em;text-transform:uppercase;font-weight:500;color:#17727f;">${escape(content.kicker)}</p>
            <h1 style="margin:0 0 18px;font-family:${DISPLAY};font-size:40px;line-height:0.98;letter-spacing:0.02em;text-transform:uppercase;font-weight:400;color:${INK};" class="display ink">${escape(content.heading)}</h1>
            ${paragraphs}
            ${content.button ? button(content.button.label, content.button.url) : ''}
            ${link}
          </td>
        </tr>

        ${
           footnotes
              ? `<tr>
          <td bgcolor="${WHITE}" style="background:${WHITE};padding:0 34px 30px;" class="card pad">
            <div style="border-top:1px solid ${LINE};padding-top:18px;" class="rule">${footnotes}</div>
          </td>
        </tr>`
              : ''
        }

        <tr>
          <td style="padding:20px 34px 0;" class="pad">
            <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${INK_3};">Fisherfeed, a fishing log for the South African coast.</p>
            <p style="margin:6px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${INK_3};">This is a message about your account, not a newsletter.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

   /*
    * The plain text part, which is not a courtesy: a mail with no text
    * alternative scores worse with every spam filter there is, and some people
    * read their mail this way on purpose.
    */
   const text = [
      'FISHERFEED',
      '',
      content.kicker.toUpperCase(),
      content.heading,
      '',
      ...content.body,
      ...(content.button
         ? ['', `${content.button.label}: ${content.button.url}`]
         : []),
      ...(content.footnote?.length ? ['', ...content.footnote] : []),
      '',
      'Fisherfeed, a fishing log for the South African coast.',
      'This is a message about your account, not a newsletter.',
   ].join('\n');

   return { html, text };
}
