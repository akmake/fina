/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
		fontFamily: {
			sans: [
				'IBM Plex Sans Hebrew',
				'sans-serif'
			],
			display: ['IBM Plex Sans Hebrew', 'sans-serif']
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
		colors: {
			slate: {
				50: '#f6f7fb', 100: '#eef0f7', 200: '#e1e4ef', 300: '#c8cddd',
				400: '#98a0b8', 500: '#6b7391', 600: '#4f5673', 700: '#3a405a',
				800: '#262a40', 900: '#171a2c', 950: '#0d0f1c'
			},
			// "blue" is the legacy class name for the brand colour (violet) — pages use bg-blue-600 etc.
			blue: {
				50: '#f3f0ff', 100: '#e7e2ff', 200: '#d0c7ff', 300: '#b2a2ff', 400: '#9078ff',
				500: '#7456f9', 600: '#5f3df0', 700: '#4e2fd2', 800: '#3f28a8', 900: '#342784', 950: '#1f1652'
			},
			brand: {
				DEFAULT: '#5f3df0', soft: '#f3f0ff', mint: '#14b88a', coral: '#ff6b6b', sun: '#ffb020', sky: '#2fa8ff'
			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
