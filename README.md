# Wallet Application

A modern web wallet application designed to work seamlessly with [Burner Wallet](https://www.burner.pro/) using libholo.

## Overview

This project provides a comprehensive wallet interface that integrates with Burner Wallet's infrastructure, leveraging libholo for enhanced functionality and security. The application offers a user-friendly interface for managing digital assets, performing transactions, and interacting with various blockchain networks.

## Features

- **Multi-chain Support**: Connect to multiple blockchain networks including Ethereum, Polygon, Base, Optimism, and BSC
- **Token Management**: Add custom tokens and manage your digital asset portfolio
- **Transaction History**: View and track your transaction history across supported chains
- **QR Code Integration**: Generate and scan QR codes for easy transfers
- **WalletConnect Support**: Connect with external dApps through WalletConnect protocol
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS for a responsive experience

## Burner Wallet Integration

This wallet is specifically designed to work with [Burner Wallet](https://www.burner.pro/), utilizing libholo for:

- Secure key management
- Enhanced privacy features
- Seamless cross-chain operations
- Advanced wallet functionality

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```

3. Create a `.env` file in the root directory and add the required environment variables:
   ```bash
   # WalletConnect Project ID (get from https://cloud.walletconnect.com/)
   VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
   
   # Alchemy API Key (get from https://www.alchemy.com/)
   VITE_ALCHEMY_API_KEY=your_alchemy_api_key_here
   ```

4. Start the development server:
   ```bash
   yarn dev
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Project Structure

- `src/components/` - Reusable UI components
- `src/routes/` - Application pages and routing
- `src/providers/` - Context providers for state management
- `src/lib/` - Utility libraries and configurations
- `public/` - Static assets and chain logos

## Technologies Used

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Wallet Integration**: libholo, WalletConnect
- **Blockchain**: Alchemy API, multiple chain support

## Contributing

This project is designed to work specifically with Burner Wallet infrastructure. When contributing, please ensure compatibility with libholo and Burner Wallet standards.

## License

This project is part of the Burner Wallet ecosystem. Please refer to Burner Wallet's licensing terms for usage guidelines.
