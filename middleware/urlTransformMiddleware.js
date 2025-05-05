// middleware/urlTransformMiddleware.js
const transformImageUrls = (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Only transform JSON responses
      if (res.getHeader('Content-Type') === 'application/json' || 
          (typeof body === 'string' && body.startsWith('{'))) {
        try {
          const baseUrl = process.env.BACKEND_BASE_URL || 
                          `${req.protocol}://${req.get('host')}`;
          
          const transformUrl = (url) => {
            if (!url) return url;
            if (typeof url !== 'string') return url;
            if (url.startsWith('http')) return url;
            return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
          };
          
          const transformObject = (obj) => {
            if (!obj || typeof obj !== 'object') return obj;
            
            // Handle arrays
            if (Array.isArray(obj)) {
              return obj.map(item => transformObject(item));
            }
            
            // Handle objects
            const transformed = {...obj};
            
            // Fields that might contain image URLs
            const imgFields = ['avatar', 'imageSrc', 'imageUrl', 'image', 'profileImage', 'images'];
            
            // Transform each potential image field
            for (const key in transformed) {
              // Handle array of images
              if (key === 'images' && Array.isArray(transformed[key])) {
                transformed[key] = transformed[key].map(img => 
                  typeof img === 'string' ? transformUrl(img) : 
                  (img && img.url ? {...img, url: transformUrl(img.url)} : img)
                );
              }
              // Handle standard image fields
              else if (imgFields.includes(key)) {
                transformed[key] = transformUrl(transformed[key]);
              }
              // Recursively transform nested objects
              else if (typeof transformed[key] === 'object' && transformed[key] !== null) {
                transformed[key] = transformObject(transformed[key]);
              }
            }
            
            return transformed;
          };
          
          // Parse the body if it's a JSON string
          let bodyObj = body;
          if (typeof body === 'string') {
            try {
              bodyObj = JSON.parse(body);
            } catch (e) {
              // Not valid JSON, leave as is
            }
          }
          
          // Transform URLs in the body
          if (typeof bodyObj === 'object') {
            const transformedBody = transformObject(bodyObj);
            // Send the transformed body
            arguments[0] = JSON.stringify(transformedBody);
            res.setHeader('Content-Type', 'application/json');
          }
        } catch (error) {
          console.error('URL transformation error:', error);
          // Fall back to original body if there's an error
        }
      }
      
      return originalSend.apply(this, arguments);
    };
    
    next();
  };
  
  module.exports = { transformImageUrls };