const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const app = express();
const PORT = 3000;
const USER_DATA = path.join(__dirname, 'users.json');
const DETAILS_USER_DATA = path.join(__dirname, 'details.json');
// Middleware to parse JSON request bodies
app.use(express.json());
app.use(cors());

// Setup bodyParser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Setup multer for file uploads
const upload = multer({ dest: 'public/images/' });

// API to get user data from local JSON file
app.get('/api/getusers', (req, res) => {
    // Read the USER_DATA JSON file
    fs.readFile(USER_DATA, 'utf8', (err, userData) => {
        if (err) {
            console.error('Error reading the USER_DATA JSON file:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Parse the USER_DATA JSON file
        let users;
        try {
            users = JSON.parse(userData);
        } catch (e) {
            console.error('Error parsing USER_DATA JSON file:', e);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        // Read the DETAILS_USER_DATA JSON file
        fs.readFile(DETAILS_USER_DATA, 'utf8', (err, detailsData) => {
            if (err) {
                console.error('Error reading the DETAILS_USER_DATA JSON file:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            // Parse the DETAILS_USER_DATA JSON file
            let details;
            try {
                details = JSON.parse(detailsData);
            } catch (e) {
                console.error('Error parsing DETAILS_USER_DATA JSON file:', e);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            // Filter to include only records where public is true
            const publicDetails = details.filter(detail => detail.public);

            // Find the maximum level for each RFID among public details
            const maxLevelDetails = {};
            publicDetails.forEach(detail => {
                if (!maxLevelDetails[detail.rfid] || (detail.level > maxLevelDetails[detail.rfid].level)) {
                    maxLevelDetails[detail.rfid] = detail;
                }
            });

            // Merge the two datasets based on RFID with max level details
            const mergedData = users.map(user => {
                const userDetail = maxLevelDetails[user.rfid] || {};
                let imageData = null;
                if (userDetail.imageLocation) {
                    const imagePath = path.join(__dirname, 'public', userDetail.imageLocation);
                    try {
                        imageData = fs.readFileSync(imagePath).toString('base64');
                    } catch (error) {
                        console.error(`Error reading image file for RFID ${user.rfid}:`, error);
                    }
                }

                return {
                    rfid: user.rfid,
                    name: user.name,
                    password: user.password,
                    latitude: user.latitude,
                    longitude: user.longitude,
                    level: userDetail.level || '',
                    experience: userDetail.experience || '',
                    bio: userDetail.bio || '',
                    imageLocation: userDetail.imageLocation || '',
                    completionDate: userDetail.completionDate || '',
                    public: userDetail.public || false,
                    image: imageData ? `data:image/jpeg;base64,${imageData}` : null
                };
            });

            // Send the merged data as the response
            res.json({
                success: true,
                users: mergedData
            });
        });
    });
});


// API to save user data in the local JSON file
app.post('/api/users', (req, res) => {
    const newUser = req.body;

    fs.readFile(USER_DATA, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the JSON file:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        const users = JSON.parse(data);
        users.push(newUser);

        fs.writeFile(USER_DATA, JSON.stringify(users, null, 2), (err) => {
            if (err) {
                console.error('Error writing to the JSON file:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            res.status(201).json({ message: 'User added successfully' });
        });
    });
});


// Login API
app.post('/api/login', (req, res) => {
    const { rfid, password } = req.body;

    // Find user with matching RFID and password
    fs.readFile(USER_DATA, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the JSON file:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        const users = JSON.parse(data);
        const user = users.find(user => user.rfid === rfid && user.password === password);

        if (user) {
            res.status(200).json({ success: true, message: 'Harihar ' + user.name, user_name: user.name, rfid: user.rfid });
        } else {
            res.status(401).json({ success: false, message: 'Invalid RFID or password' });
        }
    });

});


app.post('/api/details', upload.single('image'), (req, res) => {
    const rfid = req.headers.rfid;
    const { level, experience, bio } = req.body;
    const image = req.file;

    if (!rfid) {
        return res.status(400).json({ success: false, message: 'RFID not provided' });
    }

    // Store user details
    const userDetails = { rfid, level, experience, bio, imageLocation: `/images/${image.filename}` };

    // Duplicate the image in the local image folder
    const sourcePath = path.join(__dirname, 'public/images', image.filename);
    const destPath = path.join(__dirname, 'public/images', `${rfid}_${image.originalname}`);
    fs.copyFileSync(sourcePath, destPath);

    fs.readFile(DETAILS_USER_DATA, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the JSON file:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        const mainuserdetail = JSON.parse(data);
        mainuserdetail.push(userDetails);

        fs.writeFile(DETAILS_USER_DATA, JSON.stringify(mainuserdetail, null, 2), (err) => {
            if (err) {
                console.error('Error writing to the JSON file:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            res.status(200).json({ success: true, message: 'Details and image saved successfully' });
        });
    });
});

app.put('/api/updatedetails/:rfid', upload.single('image'), (req, res) => {
    const rfid = req.params.rfid;
    const { level, experience, bio, completiondate, publicView } = req.body;
    const image = req.file;

    if (!rfid) {
        return res.status(400).json({ success: false, message: 'RFID not provided' });
    }

    fs.readFile(DETAILS_USER_DATA, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading the JSON file:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        let mainuserdetail = JSON.parse(data);
        const userIndex = mainuserdetail.findIndex(user => user.rfid === rfid);

        if (userIndex === -1) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update user details
        mainuserdetail[userIndex] = {
            ...mainuserdetail[userIndex],
            level: level || mainuserdetail[userIndex].level,
            experience: experience || mainuserdetail[userIndex].experience,
            bio: bio || mainuserdetail[userIndex].bio,
            completiondate: completiondate || mainuserdetail[userIndex].completiondate,
            public: publicView !== undefined ? publicView === 'true' : mainuserdetail[userIndex].public,
        };

        if (image) {
            // Update image location
            const oldImagePath = path.join(__dirname, 'public/images', mainuserdetail[userIndex].imageLocation);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath); // Remove the old image file
            }

            // Move new image to the destination
            const destPath = path.join(__dirname, 'public/images', `${rfid}_${image.originalname}`);
            fs.renameSync(path.join(__dirname, 'public/images', image.filename), destPath);

            mainuserdetail[userIndex].imageLocation = `/images/${rfid}_${image.originalname}`;
        }

        fs.writeFile(DETAILS_USER_DATA, JSON.stringify(mainuserdetail, null, 2), (err) => {
            if (err) {
                console.error('Error writing to the JSON file:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }

            res.status(200).json({ success: true, message: 'Details updated successfully' });
        });
    });
});

app.get('/api/details/:rfid', (req, res) => {
    const rfid = req.params.rfid;

    fs.readFile(DETAILS_USER_DATA, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading JSON file');
        }

        let details;
        try {
            details = JSON.parse(data);
        } catch (e) {
            return res.status(500).send('Error parsing JSON file');
        }

        // Find the user by RFID
        let userDetails = details.filter(detail => detail.rfid === rfid);

        if (!userDetails || userDetails.length === 0) {
            return res.status(200).json({
                success: false,
                message: 'No user details found for the provided RFID'
            });
        }

        // Read and convert each image to Base64
        const imagePromises = userDetails.map((detail, index) => {
            const imagePath = path.join('public', detail.imageLocation);
            return new Promise((resolve, reject) => {
                fs.readFile(imagePath, (err, imageData) => {
                    if (err) {
                        return reject('Error reading image file');
                    }
                    userDetails[index].image = `data:image/jpeg;base64,${imageData.toString('base64')}`;
                    resolve();
                });
            });
        });

        // Wait for all image data to be processed
        Promise.all(imagePromises)
            .then(() => {
                res.json({
                    success: true,
                    details: userDetails
                });
            })
            .catch((error) => {
                console.error(error);
                res.status(500).send('Error processing image files');
            });
    });
});
app.use(express.static(path.join(__dirname, 'public')));
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
