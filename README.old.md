# Data-Driven Insights Assistant

A modern React application that allows users to upload CSV files, ask natural language questions about their data, and get AI-powered insights with beautiful visualizations. All data processing happens **client-side** in your browser - no backend required!

## ✨ Features

### Core Functionality
- 📤 **CSV Upload** - Upload any CSV file and it's loaded into an in-browser SQLite database
- 🤖 **AI-Powered Queries** - Ask questions in plain English, get SQL queries automatically
- 📊 **Beautiful Charts** - Auto-generated bar and line charts with 8-color palette
- 📋 **Data Tables** - View results in interactive tables with up to 500 rows
- 💾 **Export Results** - Download query results as CSV
- ✏️ **SQL Editor** - View, edit, and run generated SQL queries manually

### Smart Features
- 🎨 **Multi-Color Charts** - Automatic color cycling for multiple data series
- 🔍 **Schema Detection** - Automatically infers column types from your data
- 💬 **Chat Interface** - Natural conversation flow with the AI
- ⚠️ **Smart Error Messages** - Clear, actionable error messages
- 🚀 **Fast Performance** - All processing happens locally in your browser
- 🔒 **Privacy First** - Your data never leaves your browser

## 🎯 Prerequisites

- **Node.js** 18+ and npm
- **OpenAI API key** (get one at [platform.openai.com](https://platform.openai.com))

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start dev server
npm run dev
```

The application will be available at `http://localhost:5173` (or next available port)

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 📖 Usage Guide

### 1. Setup
1. Open the app in your browser
2. Enter your **OpenAI API key** in the top-right input field
3. Select your preferred model (gpt-4o-mini recommended for cost)

### 2. Upload Data
1. Click **"Choose File"** in the left panel
2. Select a CSV file from your computer
3. Wait for the success message: "Loaded X rows, Y columns"
4. Review the schema in the **"Schema & Hints"** section

### 3. Ask Questions

**Example Questions:**
```
• Show me the top 5 hotels by revenue
• What's the average rating by country?
• Count bookings per day in 2024
• Sum total revenue by channel
• List all unique categories
• Show bookings grouped by month
```

**Pro Tips:**
- Use actual column names from your schema
- Start with simple questions like "Show all data"
- Include keywords: top, count, sum, average, group by
- Be specific: "top 10 by revenue" vs "show hotels"

### 4. View Results
- **Table Tab** - View data in a sortable table
- **Chart Tab** - See automatic visualizations (bar/line charts)
- **SQL Tab** - View, edit, and run the generated SQL

### 5. Export Data
- Click **"Download CSV"** in the Table tab to export results

## 🎨 Chart Colors

The app uses an 8-color palette that automatically cycles for multiple data series:

1. 🔵 Blue (#3b82f6)
2. 🟢 Green (#10b981)
3. 🟠 Orange (#f59e0b)
4. 🟣 Purple (#8b5cf6)
5. 🔴 Red (#ef4444)
6. 🔷 Teal (#14b8a6)
7. 🩷 Pink (#ec4899)
8. 💙 Indigo (#6366f1)

## 🛠️ Tech Stack

### Frontend
- **React 18.3** - UI framework with hooks
- **TypeScript 5.4** - Type safety and better DX
- **Vite 5.2** - Lightning-fast build tool
- **Tailwind CSS 3.4** - Utility-first styling

### UI Components
- **shadcn/ui** - Beautiful, accessible components
- **Radix UI** - Unstyled, accessible primitives
- **Lucide React** - Icon library
- **Framer Motion** - Smooth animations

### Data Processing
- **sql.js 1.10** - SQLite compiled to WebAssembly
- **PapaParse 5.4** - Fast CSV parser
- **Recharts 2.12** - Composable charting library

### AI Integration
- **OpenAI API** - GPT models for natural language to SQL

## 📁 Project Structure

```
├── src/
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Application entry point
│   ├── index.css            # Global Tailwind styles
│   ├── config/
│   │   └── prompts.ts       # AI prompts and constants
│   ├── components/
│   │   └── ui/              # UI components (Button, Card, etc.)
│   └── lib/
│       └── utils.ts         # Utility functions (cn helper)
├── docs/
│   └── API_REQUEST.md       # OpenAI API request documentation
├── public/                  # Static assets
├── index.html               # HTML entry point
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── postcss.config.js        # PostCSS configuration
└── package.json             # Dependencies and scripts
```

## ⚙️ Configuration

### Customizing AI Prompts

Edit `src/config/prompts.ts` to modify:
- System prompt for query generation
- Chart color palette
- Welcome message

### Supported Models

The app supports these OpenAI models:
- `gpt-4o-mini` (Recommended - fast and cost-effective)
- `gpt-4o` (More capable, higher cost)
- `gpt-4.1-mini` (Latest mini model)

## 🐛 Troubleshooting

### Common Issues

**"Table not found" Error**
- ✅ Make sure you've uploaded a CSV file first
- ✅ Wait for "Loaded X rows" confirmation message

**"AI did not generate SQL" Error**
- ✅ Check your OpenAI API key is correct
- ✅ Rephrase your question to be more specific
- ✅ Try simpler questions first

**Empty Screen**
- ✅ Check browser console (F12) for errors
- ✅ Refresh the page
- ✅ Clear browser cache and restart dev server

**Charts Not Showing**
- ✅ Ensure query returns at least 2 columns
- ✅ At least one column should be numeric
- ✅ Try queries with aggregations (COUNT, SUM, AVG)

## 🔐 Privacy & Security

- ✅ **All data stays in your browser** - CSV files never leave your machine
- ✅ **No backend servers** - Everything runs client-side
- ✅ **API key stored locally** - Not persisted, only kept in memory
- ⚠️ **OpenAI sees**: Your question + table schema (column names and sample values)
- ⚠️ **OpenAI does NOT see**: Your actual data rows

### What Gets Sent to OpenAI?

For complete transparency about the API requests, see [API Request Documentation](docs/API_REQUEST.md) which includes:
- Exact request/response structure
- Real examples
- Privacy analysis
- Data flow diagram

**Quick Summary:**
- **Sent:** Your question, column names, data types, one sample value per column
- **NOT sent:** Full CSV content, all data rows, your API key (body), personal info

## 🤝 Contributing

Contributions are welcome! This is a modern React + TypeScript project with:
- ESLint for code quality
- Prettier for formatting (recommended)
- TypeScript for type safety

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- Built with [Vite](https://vitejs.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Powered by [OpenAI](https://openai.com/)
- SQLite via [sql.js](https://github.com/sql-js/sql.js)
