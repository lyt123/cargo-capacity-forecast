import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        border: '#E5E7EB',
        muted: '#6B7280',
      },
    },
  },
  plugins: [],
}
export default config
