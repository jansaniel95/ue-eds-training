import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Detect the current environment and return appropriate URLs
 */
function getEnvironmentConfig() {
  const hostname = window.location.hostname;
  const origin = window.location.origin;
  
  // AEM Universal Editor (author environment)
  if (hostname.includes('author-') && hostname.includes('.adobeaemcloud.com')) {
    return {
      baseUrl: origin,
      graphqlUrl: `${origin}/content/cq:graphql/jan-cf-models/endpoint.json`,
      type: 'author'
    };
  }
  
  // AEM Publish (live environment) 
  if (hostname.includes('.aem.live') || hostname.includes('.aem.page')) {
    // Try publish instance first to avoid CORS
    const publishUrl = 'https://publish-p9606-e71941.adobeaemcloud.com';
    return {
      baseUrl: publishUrl,
      graphqlUrl: `${publishUrl}/content/cq:graphql/jan-cf-models/endpoint.json`,
      type: 'publish',
      fallbackUrl: 'https://author-p9606-e71941.adobeaemcloud.com' // fallback for development
    };
  }
  
  // Localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return {
      baseUrl: 'https://author-p9606-e71941.adobeaemcloud.com',
      graphqlUrl: 'https://author-p9606-e71941.adobeaemcloud.com/content/cq:graphql/jan-cf-models/endpoint.json',
      type: 'development'
    };
  }
  
  // Default fallback
  return {
    baseUrl: 'https://author-p9606-e71941.adobeaemcloud.com',
    graphqlUrl: 'https://author-p9606-e71941.adobeaemcloud.com/content/cq:graphql/jan-cf-models/endpoint.json',
    type: 'default'
  };
}

/**
 * GraphQL fetch with CORS handling and fallback strategies
 */
async function fetchContentFragment(path) {
  const envConfig = getEnvironmentConfig();
  
  console.log('Environment config:', envConfig);
  console.log('Content fragment path:', path);
  console.log('Using GraphQL model: productCreditCardModelList');
  
  const query = `
    query {
      productCreditCardModelList{
        items{
          _path
          creditCardName
          creditCardDescription{
            plaintext
          }
          creditCardImage{
          ... on ImageRef {
                  _path
                  _authorUrl
                  _publishUrl
                }
        }
          promo{
            plaintext
          }notes{
            plaintext
          }
        }
      }
    }
  `;

  // Try primary GraphQL endpoint
  try {
    console.log('Trying primary GraphQL URL:', envConfig.graphqlUrl);
    
    const response = await fetch(envConfig.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: envConfig.type === 'author' ? 'include' : 'omit', // Only include credentials for author
      body: JSON.stringify({ query })
    });

    console.log('GraphQL Response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('GraphQL Response data:', data);
      
      if (data.data && data.data.productCreditCardModelList && data.data.productCreditCardModelList.items) {
        const item = data.data.productCreditCardModelList.items.find(item => item._path === path);
        console.log('Found item for path:', path, item);
        return item || null;
      }
    } else {
      console.error('GraphQL Error:', response.status, response.statusText);
      throw new Error(`GraphQL failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('Primary GraphQL fetch failed:', error);
    
    // CORS fallback: Try without credentials for live environments
    if (envConfig.type === 'publish' && error.message.includes('CORS')) {
      console.log('Trying CORS fallback...');
      try {
        const response = await fetch(envConfig.graphqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'omit', // No credentials to avoid CORS
          body: JSON.stringify({ query })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data.productCreditCardModelList && data.data.productCreditCardModelList.items) {
            const item = data.data.productCreditCardModelList.items.find(item => item._path === path);
            return item || null;
          }
        }
      } catch (fallbackError) {
        console.error('CORS fallback also failed:', fallbackError);
      }
    }
    
    // Alternative approach: Try direct content fragment JSON (for live environments)
    if (envConfig.type === 'publish') {
      console.log('Trying direct content fragment fetch...');
      try {
        const directUrl = `${envConfig.baseUrl}${path}.model.json`;
        const directResponse = await fetch(directUrl, {
          credentials: 'omit',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (directResponse.ok) {
          const directData = await directResponse.json();
          console.log('Direct fetch success:', directData);
          
          // Convert direct API response to expected format
          if (directData && directData.elements) {
            return convertDirectApiResponse(directData, path);
          }
        }
      } catch (directError) {
        console.error('Direct fetch also failed:', directError);
      }
    }
    
    // Final fallback: Use mock data for development/testing
    console.log('Using fallback mock data for path:', path);
    return getFallbackData(path);
  }
  
  return null;
}

/**
 * Convert direct content fragment API response to expected format
 */
function convertDirectApiResponse(directData, path) {
  try {
    const elements = directData.elements || directData.data?.elements || {};
    
    return {
      _path: path,
      creditCardName: elements.creditCardName?.value || elements.title?.value || 'Credit Card',
      creditCardDescription: {
        plaintext: elements.creditCardDescription?.value || elements.description?.value || ''
      },
      creditCardImage: {
        _path: elements.creditCardImage?.value?._path || elements.image?.value?._path || '',
        _authorUrl: elements.creditCardImage?.value?._authorUrl || elements.image?.value?._authorUrl || '',
        _publishUrl: elements.creditCardImage?.value?._publishUrl || elements.image?.value?._publishUrl || ''
      },
      promo: {
        plaintext: elements.promo?.value || ''
      },
      notes: {
        plaintext: elements.notes?.value || ''
      }
    };
  } catch (error) {
    console.error('Error converting direct API response:', error);
    return null;
  }
}

/**
 * Fallback mock data when GraphQL is not available
 */
function getFallbackData(path) {
  // Extract product name from path for mock data
  const productName = path.split('/').pop().replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase());
  
  return {
    _path: path,
    creditCardName: `${productName} Credit Card (DEMO)`,
    creditCardDescription: {
      plaintext: "⚠️ DEMO DATA: This is sample content shown because the content fragment could not be loaded due to CORS restrictions. In production, configure CORS on your AEM instance or use the publish endpoint."
    },
    creditCardImage: {
      _path: "/content/dam/sample/credit-card-image.jpg",
      _authorUrl: "https://via.placeholder.com/400x250/0066cc/ffffff?text=Demo+Credit+Card"
    },
    promo: {
      plaintext: "Demo Special Offer:\n\nThis is sample promotional content.\n\nReal data would come from your content fragment."
    },
    notes: {
      plaintext: "Demo Information:\n\nThis is sample content.\nReal content would come from AEM.\nConfigure CORS or use publish endpoint for live data."
    }
  };
}

/**
 * Create product card HTML - simplified
 */
function createProductCardHTML(productData) {
  if (!productData) {
    return '<div class="product-card-body"><h3>Error</h3><p>No data available</p></div>';
  }

  let html = '';

  // Image section
  if (productData.creditCardImage?._authorUrl || productData.creditCardImage?._path) {
    html += '<div class="product-card-image">';
    
    let imageUrl;
    const envConfig = getEnvironmentConfig();
    
    // Priority order for image URLs based on environment
    if (envConfig.type === 'publish' && productData.creditCardImage._publishUrl) {
      imageUrl = productData.creditCardImage._publishUrl;
    } else if (envConfig.type === 'author' && productData.creditCardImage._authorUrl) {
      imageUrl = productData.creditCardImage._authorUrl;
    } else if (productData.creditCardImage._authorUrl) {
      imageUrl = productData.creditCardImage._authorUrl;
    } else if (productData.creditCardImage._publishUrl) {
      imageUrl = productData.creditCardImage._publishUrl;
    } else {
      imageUrl = `${envConfig.baseUrl}${productData.creditCardImage._path}`;
    }
    
    html += `<picture><img src="${imageUrl}" alt="${productData.creditCardName || 'Credit Card'}" loading="lazy"></picture>`;
    html += '</div>';
  }

  // Body section
  html += '<div class="product-card-body">';

  // Title
  if (productData.creditCardName) {
    html += `<h3 class="product-title">${productData.creditCardName}</h3>`;
  }

  // Description
  if (productData.creditCardDescription?.plaintext) {
    html += `<p class="product-description">${productData.creditCardDescription.plaintext}</p>`;
  }

  // Promo
  if (productData.promo?.plaintext) {
    html += '<div class="product-promo">';
    const promoLines = productData.promo.plaintext.split('\n').filter(line => line.trim());
    
    promoLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.endsWith(':') || trimmedLine.toLowerCase().includes('special offer')) {
        html += `<h4>${trimmedLine}</h4>`;
      } else if (trimmedLine) {
        const formattedText = trimmedLine
          .replace(/(\d{1,3}(?:,\d{3})*)/g, '<strong>$1</strong>')
          .replace(/(\$\d+)/g, '<strong>$1</strong>')
          .replace(/(\d+(?:\.\d+)?%)/g, '<strong>$1</strong>');
        html += `<p>${formattedText}</p>`;
      }
    });
    
    html += '</div>';
  }

  // Notes
  if (productData.notes?.plaintext) {
    html += '<div class="product-notes">';
    const notesLines = productData.notes.plaintext.split('\n').filter(line => line.trim());
    
    let inList = false;
    notesLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.endsWith(':') || trimmedLine.toLowerCase().includes('important')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h4>${trimmedLine}</h4><ul>`;
        inList = true;
      } else if (trimmedLine && inList) {
        if (trimmedLine.includes(' - ')) {
          const [label, value] = trimmedLine.split(' - ', 2);
          html += `<li>${label.trim()} - <span class="fee">${value.trim()}</span></li>`;
        } else {
          html += `<li>${trimmedLine}</li>`;
        }
      }
    });
    
    if (inList) html += '</ul>';
    html += '</div>';
  }

  // CTA
  html += '<div class="product-cta"><a href="#" class="product-cta-button">Find out more</a></div>';
  html += '</div>';

  return html;
}

/**
 * decorate function - simplified like cards block with Universal Editor support
 */
export default async function decorate(block) {
  const envConfig = getEnvironmentConfig();
  console.log('🚀 Products Block - Environment:', envConfig.type, envConfig.baseUrl);
  
  const ul = document.createElement('ul');
  
  // Process each row like cards block does
  const rows = [...block.children];
  console.log(`📦 Processing ${rows.length} product rows`);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Find content fragment path from the row - multiple ways
    let contentFragmentPath = null;
    let detectionMethod = '';
    
    // Method 1: Check for link
    const link = row.querySelector('a');
    if (link) {
      contentFragmentPath = link.getAttribute('href');
      detectionMethod = 'link href';
    }
    
    // Method 2: Check row text content
    if (!contentFragmentPath) {
      const rowText = row.textContent.trim();
      if (rowText.startsWith('/content')) {
        contentFragmentPath = rowText;
        detectionMethod = 'text content';
      }
    }
    
    // Method 3: Check for data attributes (Universal Editor might use these)
    if (!contentFragmentPath) {
      const dataPath = row.getAttribute('data-path') || row.getAttribute('data-aue-resource');
      if (dataPath && dataPath.startsWith('/content')) {
        contentFragmentPath = dataPath;
        detectionMethod = 'data attribute';
      }
    }
    
    // Method 4: Check for aem-content-fragment picker field (Universal Editor)
    if (!contentFragmentPath) {
      const pickerInput = row.querySelector('input[name="picker"]') || 
                          row.querySelector('[data-aue-prop="picker"]') ||
                          row.querySelector('[data-aue-model="product"] input[name="picker"]');
      if (pickerInput) {
        const fragmentValue = pickerInput.value || pickerInput.textContent;
        if (fragmentValue && fragmentValue.startsWith('/content')) {
          contentFragmentPath = fragmentValue;
          detectionMethod = 'picker input';
        }
      }
    }
    
    // Method 5: Check for any input with content fragment path
    if (!contentFragmentPath) {
      const allInputs = row.querySelectorAll('input');
      for (const input of allInputs) {
        const value = input.value || input.getAttribute('value');
        if (value && value.startsWith('/content/dam')) {
          contentFragmentPath = value;
          detectionMethod = 'generic input';
          break;
        }
      }
    }
    
    console.log(`🔍 Row ${i + 1}: ${contentFragmentPath ? `Found via ${detectionMethod}` : 'No path found'} - ${contentFragmentPath || 'N/A'}`);
    
    if (contentFragmentPath && contentFragmentPath.startsWith('/content')) {
      // Create li like cards block
      const li = document.createElement('li');
      li.className = 'product-card';
      li.setAttribute('data-product-path', contentFragmentPath);
      moveInstrumentation(row, li);
      
      try {
        // Fetch content fragment data
        const productData = await fetchContentFragment(contentFragmentPath);
        
        if (productData) {
          li.innerHTML = createProductCardHTML(productData);
          console.log(`✅ Row ${i + 1}: Card created successfully`);
        } else {
          li.innerHTML = `<div class="product-card-body"><h3>No Data</h3><p>Content fragment not found: ${contentFragmentPath}</p></div>`;
          console.warn(`⚠️ Row ${i + 1}: No product data returned`);
        }
      } catch (error) {
        console.error(`❌ Row ${i + 1}: Error -`, error.message);
        li.innerHTML = `<div class="product-card-body"><h3>Error</h3><p>${error.message}</p></div>`;
      }
      
      ul.append(li);
    } else {
      console.warn(`⚠️ Row ${i + 1}: No valid content fragment path found`);
    }
  }
  
  // Clear block and append ul like cards block
  block.textContent = '';
  block.append(ul);
  
  console.log(`🎯 Products Block Complete: ${ul.children.length} cards created`);
}