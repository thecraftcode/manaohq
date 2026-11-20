import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#3E88B0",
                "primary-hover": "#2c6a8c",
                "secondary": "#893eb1",
                "background-light": "#F4F2ED",
                "background-dark": "#1a141e",
                "surface-white": "#FFFFFF",
                "border-subtle": "#C0CFDB",
                "text-main": "#1F2937",
                "text-muted": "#6DA5CA",
                "badge-draft": "#ECDCB7",
                "badge-review": "#D1E3F5",
                "badge-published": "#C8E6C9",
            },
            fontFamily: {
                manrope: ["var(--font-manrope)", "sans-serif"],
            },
            borderRadius: {
                "DEFAULT": "0.5rem",
                "lg": "0.75rem",
                "xl": "1rem",
                "2xl": "1.5rem",
                "3xl": "2rem",
                "full": "9999px"
            },
        },
    },
    plugins: [],
};
export default config;
