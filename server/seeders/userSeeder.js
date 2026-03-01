import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// User Schema (inline to avoid import issues)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  address: {
    street: { type: String, required: false },
    city: { type: String, required: false },
    postalCode: { type: String, required: false },
    country: { type: String, required: false, default: 'Philippines' },
  },
  phone: { type: String, required: false },
  image: {
    public_id: { type: String, required: false },
    url: { type: String, required: false },
  },
  password: { type: String, required: true },
  role: { type: String, enum: ['guest', 'driver', 'operator', 'admin'], default: 'guest' },
  isVerified: { type: Boolean, default: true },
  FCMToken: { type: String, required: false },
  rating: { type: Number, default: 0 },
  numReviews: { type: Number, default: 0 },
  tripCount: { type: Number, default: 0 },
  lostFoundPosted: { type: Number, default: 0 },
  lostFoundClaimed: { type: Number, default: 0 },
  loyaltyMonths: { type: Number, default: 0 },
  reviews: { type: [mongoose.Schema.Types.ObjectId], ref: "Review", default: [] },
  lastLogin: { type: Date, default: Date.now },
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Driver users
const driverNames = [
  "ABAD, JOHN NIKKO BURCE",
  "AMBITO, DOMINGO FLORENTINO",
  "AVILA, JESUS VALENZUELA",
  "BALASE JR, ELARDE AQUINO",
  "BALON, LERY JAY DANDO",
  "BASILAN, JOEL GORA",
  "BASILAN, JOSEFINO CANDIA",
  "BELTRAN, ROLLY ESPINEDA",
  "BOLO, REY BIAZON",
  "BORALE, NEL ADONIS CAAYUHAN",
  "BORBO, JOVEN CARULLO",
  "CABALAGAN, REYNALDO AGNOTE",
  "CABRAL, MELVIN DELOS SANTOS",
  "CAINONG, MEDARDO LOREN",
  "CAMILA, RAQUIN GODESANO",
  "CAMPO, RANDY GENTE",
  "CASTILLO, EUFROCINO BINGCANG",
  "COLMO, RANDY PEREMNE",
  "COMIA, NELSON REMO",
  "DALISAY, JOSHUA DUENAS",
  "DAMAYO, ALLAN PAHILINO",
  "DARASIN, ALDRED TUMBAGA",
  "DARASIN, EDUARDO GASIL",
  "DARASIN, HARDY TUMBAGA",
  "DARASIN, JOEMARIE TUMBAGA",
  "DELMINDO, ISAMAEL MELLAROSO",
  "DE LOS SANTOS, GLENBERT LAMBON",
  "DE LOS SANTOS, SONNY MARTICIO",
  "DIMANZANA, LEONIVO JASA",
  "DIMANZANA, MARIO JASA",
  "ESPIJA, HERNANE MAHILUM",
  "ESPIRITU, AMIEL ESPIRITU",
  "ESTOBIO, RENATO LONQUAS",
  "ETLANAS, ERNESTO EBANYES",
  "EVANGELISTA, JOSELITO SACDALAN",
  "FERNANDEZ, FERDINAND CAYA",
  "FRAGO, NIKKO PANALIGAN",
  "GALICIA, RENAN GARAO",
  "GALLEGO, SERGIO CUNAG",
  "GOMEZ, GLEN ORBILLO",
  "GOMEZ, REY OMIPIG",
  "GONGONA, JOSEPHINE BALDERAS",
  "GONGONA, JULITO BALDERAS",
  "GONZAGA, ANTONIO CURIOSO",
  "GUILAS, ARTHUR CERESO",
  "GUILAS, FLORENCIO CERESO",
  "IBANEZ, ALLAN BONITE",
  "JACOBA, BOBBY GANGAN",
  "JARDINEL, EDDIE MILLA",
  "CAMBON, NORIEL SEDANTES",
  "LAVANDERO, RODEL DAJAC",
  "LAZO, REYNEIL FRANCISCO DE LA CRUZ",
  "LEYTE, MELVIN ESTANILLA",
  "LINGON, BERNALDO HISTORILLO",
  "LINGON, TEODORO HISTORILLO",
  "LUCHAVEZ, ALBERTO ASIS",
  "MACASANDAG, ARNEL BUCTOT",
  "MALTO, VILMAR GONGONA",
  "MANCIO, FRANCISCO KUIZON",
  "MANIPOL, JEROME MARAYAN",
  "MANIPOL, SALVADOR MARAYAN",
  "MONTILLA, JEFFREY APATTAD",
  "MORATALLA, REYNALDO MURILLO",
  "NARAG, CHRISTOPHER",
  "NOORA, ARIEL LABODIT",
  "ONING, GLEN MARK DAR",
  "PARAGAS, ERMERSON ARBIAS",
  "PARAGAS, RONQUILLO BASA",
  "PERLAS, CHRISTIAN ARIOLA",
  "PORAZO, NINO SALVADORA",
  "REAL, RONNEL JASA",
  "ROCERO, JEFFREY VEGA",
  "SABANAL, RICHARD ENARLE",
  "SANO, ALEXANDER FONTANEL",
  "SANTOS, CARLO PARAGAS",
  "SENORIN, ARNIE FAJANILAN",
  "SENORIN, GILBERT PERLAS",
  "SENORIN, ELMER PERLAS",
  "SERDENA, EFREN CAUNCERAN",
  "SOLAS, MIENRADO RINGOR",
  "TACATA, DENNIS DAJAC",
  "TADURAN, DARVIN TOLOP",
  "TANDAYU, GEORGE ACOBA",
  "TIMUAT, JOSEPH ABINES",
  "TRILLES, ROMMICK DIZON",
  "VALDEZ, RICSON ATIENZA",
  "VALENZUELA JR, BENJAMIN ACAMPANADO",
  "VALENZUELA, JIMMY ACOMPANADO",
  "VALENZUELA, JOHNLANCE ENCARNACION",
  "VALLAR, ANDRES POLITUD",
  "VARGAS, JOEBERT SERVINO",
  "YLAGAN, FREDDIE BOY SERVINO",
  "ZETA, MOISES MORALES",
];

// Guest users
const guestNames = [
  "KRISTINE JOY BALDOZA",
  "MILA S. BALDOZA",
  "LEOPOLDO A. BALDOZA JR.",
  "LIZA R. LACAO",
  "ROSELIZA R. LACAO",
];

// Parse name in format "LASTNAME, FIRSTNAME MIDDLENAME" or "FIRSTNAME MIDDLENAME LASTNAME"
function parseName(fullName) {
  // Check if name contains comma (LASTNAME, FIRSTNAME format)
  if (fullName.includes(',')) {
    const parts = fullName.split(',').map(p => p.trim());
    const lastname = parts[0];
    const firstnameParts = parts[1] ? parts[1].split(' ') : [''];
    const firstname = firstnameParts[0] || '';
    return { firstname, lastname };
  } else {
    // Format: FIRSTNAME MIDDLENAME LASTNAME (for guest users)
    const parts = fullName.split(' ').filter(p => p.length > 0);
    if (parts.length === 1) {
      return { firstname: parts[0], lastname: '' };
    } else if (parts.length === 2) {
      return { firstname: parts[0], lastname: parts[1] };
    } else {
      // First part is firstname, last part is lastname
      const firstname = parts[0];
      const lastname = parts[parts.length - 1];
      return { firstname, lastname };
    }
  }
}

// Generate username from name
function generateUsername(fullName) {
  const { firstname, lastname } = parseName(fullName);
  const cleanFirst = firstname.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastname.toLowerCase().replace(/[^a-z]/g, '');
  return `${cleanFirst}.${cleanLast}`;
}

// Generate email from name
function generateEmail(fullName) {
  const { firstname, lastname } = parseName(fullName);
  const cleanFirst = firstname.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastname.toLowerCase().replace(/[^a-z]/g, '');
  return `${cleanFirst}.${cleanLast}@webttrac.com`;
}

async function seedUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Hash the default password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const users = [];

    // Create driver users
    for (const name of driverNames) {
      const { firstname, lastname } = parseName(name);
      users.push({
        username: generateUsername(name),
        firstname: firstname,
        lastname: lastname,
        email: generateEmail(name),
        password: hashedPassword,
        role: 'driver',
        isVerified: true,
        address: {
          country: 'Philippines'
        }
      });
    }

    // Create guest users
    for (const name of guestNames) {
      const { firstname, lastname } = parseName(name);
      users.push({
        username: generateUsername(name),
        firstname: firstname,
        lastname: lastname,
        email: generateEmail(name),
        password: hashedPassword,
        role: 'guest',
        isVerified: true,
        address: {
          country: 'Philippines'
        }
      });
    }

    // Insert users
    console.log(`Seeding ${users.length} users...`);
    
    for (const user of users) {
      try {
        await User.create(user);
        console.log(`Created user: ${user.username} (${user.role})`);
      } catch (err) {
        if (err.code === 11000) {
          console.log(`Skipped (already exists): ${user.username}`);
        } else {
          console.error(`Error creating ${user.username}:`, err.message);
        }
      }
    }

    console.log('\nSeeding completed!');
    console.log(`Total drivers: ${driverNames.length}`);
    console.log(`Total guests: ${guestNames.length}`);
    console.log('Default password: password123');

  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  }
}

seedUsers();
