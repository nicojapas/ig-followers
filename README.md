# Instagram Followers Analyzer

`instagram` `javascript` `privacy` `github-pages` `client-side`

A privacy-focused web tool that analyzes your Instagram data export to identify accounts that don't follow you back. All processing happens locally in your browser. No data is uploaded to any server.

## Features

- **Drag & drop interface** for Instagram data export ZIP files
- **Instant analysis** of followers vs. following
- **Ignore list** for accounts you don't expect to follow back (artists, news outlets, etc.)
- **Persistent storage** using localStorage with export/import functionality
- **Search and filter** through results
- **Unfollower tracking** by comparing each export with the previous one

## Usage

1. Download your Instagram data:
   - Go to Instagram Settings > Your activity > Download your information
   - Select JSON format and request your data
   - Wait for Instagram to email you the download link

2. Visit the [live site](https://nicojapas.github.io/ig-followers/)

3. Drag and drop the ZIP file onto the page

4. Review the accounts that don't follow you back

### Tracking unfollowers

Each export you load is saved in your browser. The next time you load one, the app lists who unfollowed you since then.

Always request the export with the date range set to **All time**. Shorter ranges only include followers gained in that period, so unfollowers can't be detected from them.

## Project Structure

```
├── index.html    # Main HTML structure
├── styles.css    # Styles
└── app.js        # Application logic
```

## Technical Notes

- Uses [JSZip](https://stuk.github.io/jszip/) for client-side ZIP extraction
- No build step required, just vanilla HTML, CSS, and JavaScript
- Ignore list persists in localStorage across sessions

## License

MIT
