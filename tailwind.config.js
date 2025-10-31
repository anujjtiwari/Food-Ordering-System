/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            colors: {
                background: "#000000",
                neon: "#39ff14",
                accent: "#00ff88",
            },
            boxShadow: {
                neon: "0 0 10px #39ff14, 0 0 20px #39ff14, 0 0 40px #39ff14",
            },
            textShadow: {
                neon: "0 0 5px #39ff14, 0 0 10px #39ff14, 0 0 20px #39ff14",
            },
        },
    },
    plugins: [
        function ({ addUtilities }) {
            addUtilities({
                ".text-glow": {
                    textShadow:
                        "0 0 5px #39ff14, 0 0 10px #39ff14, 0 0 20px #39ff14, 0 0 40px #39ff14",
                },
                ".shadow-glow": {
                    boxShadow:
                        "0 0 10px #39ff14, 0 0 20px #39ff14, 0 0 40px #39ff14, 0 0 80px #39ff14",
                },
            });
        },
    ],
};
