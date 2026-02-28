const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Mock data arrays to generate random-looking names
const firstNames = [
    'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
    'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Rian', 'Kabir', 'Rudra', 'Ansh', 'Dhruv', 'Darsh',
    'Diya', 'Aanya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Eshita', 'Riya', 'Avni', 'Gauri',
    'Kavya', 'Navya', 'Isha', 'Myra', 'Anika', 'Aahana', 'Vidhi', 'Siya', 'Shanaya', 'Nisha'
];

const lastNames = [
    'Sharma', 'Patel', 'Singh', 'Kumar', 'Das', 'Kaur', 'Gupta', 'Rao', 'Reddy', 'Chauhan',
    'Mehta', 'Nair', 'Bose', 'Verma', 'Mishra', 'Pandey', 'Yadav', 'Joshi', 'Kapoor', 'Malhotra'
];

const departments = ['Engineering', 'Finance', 'HR', 'Marketing', 'Sales', 'Operations', 'Design'];

function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function generatePlayer(index) {
    const isMale = index % 2 === 0; // Alternate genders
    const name = `${getRandomItem(firstNames)} ${getRandomItem(lastNames)}`;
    const gender = isMale ? 'M' : 'F';
    const department = getRandomItem(departments);
    const categories = isMale ? 'MS, MD, XD' : 'WS, WD, XD';
    const seeded = index < 8 ? 'true' : 'false'; // Seed the first 8 players

    return {
        name,
        gender,
        department,
        categories,
        seeded,
    };
}

function generateMockExcel() {
    console.log('Generating mock players...');
    const players = [];

    // Generate 32 test players (good size for groups or standard knockout bracket)
    for (let i = 0; i < 32; i++) {
        players.push(generatePlayer(i));
    }

    // Convert JSON to Worksheet
    const worksheet = XLSX.utils.json_to_sheet(players);

    // Create a new Workbook and append the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Singles');

    // Define the output path
    const outputPath = path.join(__dirname, '..', 'test-players.xlsx');

    // Write the file
    XLSX.writeFile(workbook, outputPath);

    console.log(`Successfully generated 32 mock players at: ${outputPath}`);
}

generateMockExcel();
