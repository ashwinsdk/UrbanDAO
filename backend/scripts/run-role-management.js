/**
 * UrbanDAO Role Management CLI Script
 * This script provides a CLI interface for verifying and managing roles in the UrbanDAO system.
 */

const { verifyRoles } = require('./verify-roles');
const { manageRoles } = require('./manage-roles-fixed');
const fs = require('fs');
const path = require('path');

// Load .env.roles file first
require('dotenv').config({ path: path.join(__dirname, '../.env.roles') });

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  console.log('UrbanDAO Role Management CLI');
  console.log('=============================');
  
  // Display current state
  console.log(`Network: ${process.env.SEPOLIA_RPC_URL ? 'Sepolia' : 'Local'}`);
  console.log(`Contract: ${process.env.URBAN_CORE_ADDRESS || 'Using address from deployed/addresses.json'}`);
  console.log('');
  
  switch (command) {
    case 'verify':
      console.log('Verifying current role assignments...');
      await verifyRoles();
      break;
      
    case 'assign':
      console.log('Assigning and verifying roles...');
      await manageRoles();
      break;
      
    case 'help':
    default:
      printHelp();
      break;
  }
}

function printHelp() {
  console.log('Usage: node run-role-management.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  verify    Check current role assignments without making changes');
  console.log('  assign    Assign missing roles according to roles.json configuration');
  console.log('  help      Display this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node run-role-management.js verify');
  console.log('  node run-role-management.js assign');
}

// Run the main function
main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
