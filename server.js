var express = require('express');
var multer = require('multer');
var fs = require('fs');
var sharp = require('sharp');
var cache = require('memory-cache');
const path = require('path');
var app = express();
const readdirp = require('readdirp');
const cors = require('cors'); // Add this line for CORS support

app.use(cors());

app.set('view engine', 'ejs');

// Set cache duration to 5 days (in milliseconds)
const cacheDuration = 5 * 24 * 60 * 60 * 1000;
app.use('/uploads', (req, res, next) => {
    console.log(`[${new Date().toLocaleString()}] Serving static file for: ${req.url}`);
    express.static(path.join(__dirname, 'uploads'))(req, res, next);
});

app.get('/', (req, res) => {
    res.render('index');
});

// Clear cache endpoint
app.get('/clearcache', (req, res) => {
    cache.clear();
    res.send('Cache cleared.');
});



app.get('/getfile/:filename', (req, res) => {
    const filename = req.params.filename;

    // Check if file content is in cache
    const cachedFileContent = cache.get(filename);
    if (cachedFileContent) {
        console.log('File fetched from cache:', filename);

      
        // Send the cached file content as a response
        res.writeHead(200, {'ContentType': 'image/jpeg' });
        res.end(cachedFileContent, 'Base64');
       
    } else {
        // If not in cache, check if the file exists in the storage
        const filePath = path.join(__dirname, 'uploads', `${filename}`);
        if (fs.existsSync(filePath)) {
            // Read the file content and cache it
            const fileContent = fs.readFileSync(filePath);

            // Cache the file content
            cache.put(filename, fileContent, cacheDuration);
            console.log('File fetched from disk:', filename);

            // Set the appropriate Content-Type header
            res.writeHead(200, {'ContentType': 'image/jpeg' });
            res.end(fileContent, 'Base64');
        } else {
            // If the file doesn't exist, send a 404 response
            res.status(404).send('File not found.');
        }
    }
});


var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        var dir = './uploads';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        callback(null, dir);
    },
    filename: function (req, file, callback) {
        callback(null, file.originalname);
    }
});

var upload = multer({ storage: storage }).array('files', 12);

app.post('/upload', function (req, res, next) {
    upload(req, res, async function (err) {
        if (err) {
            return res.end("Something went wrong:(");
        }

        // Compress and scale down the uploaded images using Sharp
        await processImages(req.files);

        res.json(req.files.map(file => `${file.originalname}`));
    });
});




async function processImages(files) {
    // Loop through each uploaded file
    for (const file of files) {
        // Get image metadata to calculate aspect ratio
        const metadata = await sharp(file.path).metadata();

        // Scale down the image by 50%
        await sharp(file.path)
            .resize({ width: metadata.width * 0.5, height: metadata.height * 0.5 })
            .toFile(`./uploads/${file.originalname}`);

        // Remove the original file
        fs.unlinkSync(file.path);
    }
}



// Import necessary modules


// ... (existing code)

// New endpoint to get category images
app.get('/categoryImages', async (req, res) => {
    try {
        // Directory path to scan for category images
        const categoryImagesPath = './uploads';

        // Scan the directory and subdirectories
        const files = await readdirp.promise(categoryImagesPath, { fileFilter: '*.png' });

        // Extract only the file names
        const iconNames = files.map(file => ({ name: file.basename }));

        // Prepare and send the JSON response
        res.json({ data: iconNames });
    } catch (error) {
        // Handle any errors that may occur during the process
        console.error('Error fetching category images:', error);
        res.status(500).send('Internal Server Error');
    }
});

// ... (existing code)


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
