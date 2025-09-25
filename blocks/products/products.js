import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Detect the current environment and return appropriate base URL
 */
function getBaseUrl() {
  // Check if we're in Universal Editor (AEM author)
  if (window.location.hostname.includes('author-') || window.location.hostname.includes('.adobeaemcloud.com')) {
    return window.location.origin;
  }
  
  // Check if we're in localhost (development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'https://author-p9606-e71941.adobeaemcloud.com';
  }
  
  // Default to the author instance
  return 'https://author-p9606-e71941.adobeaemcloud.com';
}

/**
 * GraphQL fetch for credit card content fragments with environment detection
 */
async function fetchContentFragment(path) {
  const baseUrl = getBaseUrl();
  const graphqlUrl = `${baseUrl}/content/cq:graphql/your-project/endpoint.json`;
  
  console.log('Fetching from environment:', baseUrl);
  console.log('GraphQL URL:', graphqlUrl);
  console.log('Content fragment path:', path);
  
  const query = `
    query {
      creditCardList{
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

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ query })
    });

    console.log('GraphQL Response status:', response.status);

    if (response.ok) {
      const data = await response.json();
      console.log('GraphQL Response data:', data);
      
      if (data.data && data.data.creditCardList && data.data.creditCardList.items) {
        const item = data.data.creditCardList.items.find(item => item._path === path);
        console.log('Found item for path:', path, item);
        return item || null;
      }
    } else {
      console.error('GraphQL Error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
  
  return null;
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
    if (productData.creditCardImage._authorUrl) {
      imageUrl = productData.creditCardImage._authorUrl;
    } else if (productData.creditCardImage._publishUrl) {
      imageUrl = productData.creditCardImage._publishUrl;
    } else {
      const baseUrl = getBaseUrl();
      imageUrl = `${baseUrl}${productData.creditCardImage._path}`;
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
  console.log('=== PRODUCTS BLOCK START ===');
  console.log('Block element:', block);
  console.log('Block children count:', block.children.length);
  console.log('Current environment:', getBaseUrl());
  
  const ul = document.createElement('ul');
  
  // Process each row like cards block does
  const rows = [...block.children];
  console.log('Processing rows:', rows.length);
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`Processing row ${i + 1}:`, row.outerHTML);
    
    // Find content fragment path from the row - multiple ways
    let contentFragmentPath = null;
    
    // Method 1: Check for link
    const link = row.querySelector('a');
    if (link) {
      contentFragmentPath = link.getAttribute('href');
      console.log(`Row ${i + 1} - Found link href:`, contentFragmentPath);
    }
    
    // Method 2: Check row text content
    if (!contentFragmentPath) {
      const rowText = row.textContent.trim();
      if (rowText.startsWith('/content')) {
        contentFragmentPath = rowText;
        console.log(`Row ${i + 1} - Found text path:`, contentFragmentPath);
      }
    }
    
    // Method 3: Check for data attributes (Universal Editor might use these)
    if (!contentFragmentPath) {
      const dataPath = row.getAttribute('data-path') || row.getAttribute('data-aue-resource');
      if (dataPath && dataPath.startsWith('/content')) {
        contentFragmentPath = dataPath;
        console.log(`Row ${i + 1} - Found data attribute path:`, contentFragmentPath);
      }
    }
    
    // Method 4: Check for aem-content-fragment field (Universal Editor structured content)
    if (!contentFragmentPath) {
      const contentFragmentInput = row.querySelector('input[name="contentFragment"]') || 
                                    row.querySelector('[data-aue-prop="contentFragment"]');
      if (contentFragmentInput) {
        const fragmentValue = contentFragmentInput.value || contentFragmentInput.textContent;
        if (fragmentValue && fragmentValue.startsWith('/content')) {
          contentFragmentPath = fragmentValue;
          console.log(`Row ${i + 1} - Found structured content fragment:`, contentFragmentPath);
        }
      }
    }
    
    console.log(`Row ${i + 1} - Final path:`, contentFragmentPath);
    
    if (contentFragmentPath && contentFragmentPath.startsWith('/content')) {
      // Create li like cards block
      const li = document.createElement('li');
      li.className = 'product-card';
      li.setAttribute('data-product-path', contentFragmentPath);
      moveInstrumentation(row, li);
      
      try {
        console.log(`Fetching data for row ${i + 1}...`);
        // Fetch content fragment data
        const productData = await fetchContentFragment(contentFragmentPath);
        console.log(`Row ${i + 1} - Product data:`, productData);
        
        if (productData) {
          li.innerHTML = createProductCardHTML(productData);
          console.log(`Row ${i + 1} - Card created successfully`);
        } else {
          li.innerHTML = `<div class="product-card-body"><h3>No Data</h3><p>Content fragment not found: ${contentFragmentPath}</p></div>`;
          console.warn(`Row ${i + 1} - No product data returned`);
        }
      } catch (error) {
        console.error(`Row ${i + 1} - Error:`, error);
        li.innerHTML = `<div class="product-card-body"><h3>Error</h3><p>${error.message}</p></div>`;
      }
      
      ul.append(li);
    } else {
      console.warn(`Row ${i + 1} - No valid content fragment path found`);
    }
  }
  
  console.log('Final card count:', ul.children.length);
  
  // Clear block and append ul like cards block
  block.textContent = '';
  block.append(ul);
  
  console.log('=== PRODUCTS BLOCK COMPLETE ===');
}