const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// API: Get list of image pairs from /public/image folder
app.get('/api/image-pairs', (req, res) => {
  try {
    const imageDir = path.join(__dirname, 'public', 'image');
    console.log('[API] GET /api/image-pairs - imageDir:', imageDir);

    if (!fs.existsSync(imageDir)) {
      console.warn('[API] Image directory does not exist:', imageDir);
      return res.json({ pairs: [] });
    }

    const files = fs.readdirSync(imageDir).filter(f => f.endsWith('.png'));
    console.log('[API] Found PNG files:', files);

    // Parse pairs: kor_image_00001_.png + kor_depth_00001_.png
    const pairs = {};
    files.forEach(file => {
      const match = file.match(/kor_(image|depth)_(\d+)_\.png/);
      console.log(`[API] File: ${file} -> Match:`, match);
      if (match) {
        const type = match[1];
        const num = match[2];
        if (!pairs[num]) pairs[num] = {};
        pairs[num][type] = `/image/${file}`;
      }
    });

    console.log('[API] Pairs object:', pairs);

    // Convert to array and sort by number
    const pairArray = Object.entries(pairs)
      .filter(([_, p]) => p.image && p.depth)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([_, p]) => p);

    console.log('[API] Final pairArray:', pairArray);
    res.json({ pairs: pairArray });
  } catch (err) {
    console.error('[API Error]', err);
    res.status(500).json({ error: 'Failed to read image pairs' });
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));