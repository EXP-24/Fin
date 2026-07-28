/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "on-background": "#0b1c30",
        "surface-container": "#e5eeff",
        "secondary-fixed-dim": "#4edea3",
        "on-primary-fixed-variant": "#3f465c",
        "error": "#ba1a1a",
        "secondary-fixed": "#6ffbbe",
        "on-tertiary-fixed-variant": "#004395",
        "outline": "#76777d",
        "on-surface": "#0b1c30",
        "on-secondary": "#ffffff",
        "primary-fixed-dim": "#bec6e0",
        "secondary-container": "#6cf8bb",
        "on-error-container": "#93000a",
        "error-container": "#ffdad6",
        "tertiary-fixed": "#d8e2ff",
        "tertiary-fixed-dim": "#adc6ff",
        "on-secondary-fixed": "#002113",
        "inverse-primary": "#bec6e0",
        "surface-container-high": "#dce9ff",
        "surface-container-highest": "#d3e4fe",
        "on-surface-variant": "#45464d",
        "inverse-on-surface": "#eaf1ff",
        "inverse-surface": "#213145",
        "tertiary": "#000000",
        "on-tertiary-fixed": "#001a42",
        "on-tertiary-container": "#3980f4",
        "surface-bright": "#f8f9ff",
        "surface": "#f8f9ff",
        "outline-variant": "#c6c6cd",
        "primary-fixed": "#dae2fd",
        "on-primary-container": "#7c839b",
        "tertiary-container": "#001a42",
        "on-secondary-container": "#00714d",
        "on-error": "#ffffff",
        "secondary": "#006c49",
        "on-primary-fixed": "#131b2e",
        "primary-container": "#131b2e",
        "surface-dim": "#cbdbf5",
        "on-secondary-fixed-variant": "#005236",
        "surface-container-low": "#eff4ff",
        "on-primary": "#ffffff",
        "primary": "#000000",
        "background": "#f8f9ff",
        "on-tertiary": "#ffffff",
        "surface-tint": "#565e74",
        "surface-container-lowest": "#ffffff",
        "surface-variant": "#d3e4fe"
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      spacing: {
        "chat-max-width": "800px",
        "unit": "4px",
        "margin-desktop": "32px",
        "margin-mobile": "16px",
        "gutter": "24px",
        "sidebar-width": "280px"
      },
      fontFamily: {
        "headline-md": ["Inter"],
        "display-lg": ["Inter"],
        "body-sm": ["Inter"],
        "headline-md-mobile": ["Inter"],
        "body-lg": ["Inter"],
        "label-mono": ["JetBrains Mono"]
      },
      fontSize: {
        "headline-md": ["24px", { "lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600" }],
        "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "700" }],
        "body-sm": ["14px", { "lineHeight": "20px", "fontWeight": "400" }],
        "headline-md-mobile": ["20px", { "lineHeight": "28px", "fontWeight": "600" }],
        "body-lg": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
        "label-mono": ["12px", { "lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "500" }]
      }
    }
  },
  plugins: [],
}
