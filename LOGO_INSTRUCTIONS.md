# How to Add Your Company Logo

## Quick Instructions

1. **Prepare your logo file:**
   - Recommended formats: PNG (with transparent background) or SVG
   - Recommended dimensions: At least 200px wide for best quality
   - The logo will automatically scale to fit the sidebar (height: 48px)

2. **Add your logo (easiest method):**
   - Save your logo file as `logo.svg` or `logo.png`
   - Place it in the `/public/` folder
   - **It will replace the placeholder automatically!**
   
3. **If using a different filename or format:**
   - Open `src/App.tsx`
   - Find line 209: `src="/logo.svg"`
   - Change it to your filename, e.g., `src="/my-company-logo.png"`

## Supported Formats
- **PNG** (best for photos/complex logos with transparency)
- **SVG** (best for simple vector logos, scales perfectly)
- **JPG** (works but no transparency)
- **WEBP** (modern format with good compression)

## Tips for Best Results
- Use a transparent background (PNG or SVG)
- For dark sidebar backgrounds, use a light-colored logo
- Horizontal logos work better than vertical ones in the sidebar
- If your logo has a tagline, you can remove it for a cleaner look

## Current Location
Your logo will appear at the top of the left sidebar, above the navigation menu.

