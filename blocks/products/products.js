import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Simple GraphQL fetch for credit card content fragments
 */

async function fetchContentFragment(path) {
  console.log('Fetching content fragment:', path);
  
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

  // Detect environment and choose appropriate strategy
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isAuthorEnvironment = window.location.hostname.includes('author-');
  
  console.log('Environment detection:', { isLocalhost, isAuthorEnvironment, hostname: window.location.hostname });

  // Strategy 1: Use what was working before - Author instance for localhost and author environments
  if (isLocalhost || isAuthorEnvironment) {
    // Try different GraphQL endpoint paths since the current one is returning 403
    const graphqlEndpoints = [
      'https://author-p9606-e71941.adobeaemcloud.com/content/cq:graphql/global/endpoint.json',
      'https://author-p9606-e71941.adobeaemcloud.com/content/cq:graphql/your-project/endpoint.json', 
      'https://author-p9606-e71941.adobeaemcloud.com/content/graphql/global/endpoint.json',
      'https://author-p9606-e71941.adobeaemcloud.com/content/cq:graphql/jan-cf-models/endpoint.json'
    ];
    
    // Try each endpoint until one works
    for (let i = 0; i < graphqlEndpoints.length; i++) {
      const authorGraphqlUrl = graphqlEndpoints[i];
      
      try {
        console.log(`🔐 Trying GraphQL endpoint ${i + 1}/${graphqlEndpoints.length}:`, authorGraphqlUrl);
        
        const response = await fetch(authorGraphqlUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ query })
        });

        console.log('📊 Response Status:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ GraphQL Data:', data);
          
          if (data.data && data.data.productCreditCardModelList && data.data.productCreditCardModelList.items) {
            const item = data.data.productCreditCardModelList.items.find(item => item._path === path);
            if (item) {
              console.log('✅ Found matching item:', item);
              return item;
            } else {
              console.log('⚠️ No item found for path:', path);
              console.log('Available items:', data.data.productCreditCardModelList.items.map(i => i._path));
            }
          }
        } else {
          const errorText = await response.text();
          console.log(`❌ Endpoint ${i + 1} failed:`, response.status, response.statusText);
          
          // If this was the last endpoint and still failing, continue to other strategies
          if (i === graphqlEndpoints.length - 1) {
            console.log('❌ All GraphQL endpoints failed, trying fallback strategies...');
          }
        }
      } catch (error) {
        console.log(`❌ Endpoint ${i + 1} error:`, error.message);
      }
    }
    
    // Alternative Strategy: Try direct Content Fragment JSON API
    try {
      console.log('🔄 Trying direct Content Fragment API...');
      const directUrl = `https://author-p9606-e71941.adobeaemcloud.com${path}.model.json`;
      console.log('Direct URL:', directUrl);
      
      const response = await fetch(directUrl, {
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      });

      console.log('📊 Direct API Response:', response.status, response.statusText);
      
      if (response.ok) {
        const directData = await response.json();
        console.log('✅ Direct API Data:', directData);
        
        // Convert AEM Content Fragment API response to expected format
        if (directData && directData.elements) {
          const elements = directData.elements;
          const convertedData = {
            _path: path,
            creditCardName: elements.creditCardName?.value || 'Credit Card',
            creditCardDescription: {
              plaintext: elements.creditCardDescription?.value || ''
            },
            creditCardImage: {
              _path: elements.creditCardImage?.value?._path || '',
              _authorUrl: elements.creditCardImage?.value?._authorUrl || '',
              _publishUrl: elements.creditCardImage?.value?._publishUrl || ''
            },
            promo: {
              plaintext: elements.promo?.value || ''
            },
            notes: {
              plaintext: elements.notes?.value || ''
            }
          };
          console.log('✅ Converted data from direct API:', convertedData);
          return convertedData;
        }
      } else {
        const errorText = await response.text();
        console.log('❌ Direct API failed:', response.status, errorText);
      }
    } catch (directError) {
      console.log('❌ Direct API error:', directError.message);
    }
  }

  // Strategy 2: For live environments, try publish without credentials
  if (!isLocalhost && !isAuthorEnvironment) {
    try {
      console.log('Using publish endpoint (live environment)...');
      const publishGraphqlUrl = 'https://publish-p9606-e71941.adobeaemcloud.com/content/cq:graphql/jan-cf-models/endpoint.json';
      
      const response = await fetch(publishGraphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'omit', // No credentials to avoid CORS issues
        body: JSON.stringify({ query })
      });

      console.log('Publish GraphQL Response:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Publish GraphQL Data:', data);
        
        if (data.data && data.data.productCreditCardModelList && data.data.productCreditCardModelList.items) {
          const item = data.data.productCreditCardModelList.items.find(item => item._path === path);
          if (item) {
            console.log('✅ Found matching item from publish:', item);
            return item;
          }
        }
      }
    } catch (error) {
      console.log('Publish endpoint failed (CORS issue?):', error.message);
    }
  }

  console.error('❌ All fetch strategies failed for:', path);
  
  // Provide helpful guidance
  console.log('');
  console.log('🔧 TROUBLESHOOTING GUIDE:');
  console.log('1. 🔐 Authentication: Login to AEM Author first:');
  console.log('   https://author-p9606-e71941.adobeaemcloud.com/');
  console.log('2. 📊 Check GraphQL endpoint exists in AEM:');
  console.log('   Tools > General > GraphQL > Configuration Browser');
  console.log('3. ✅ Verify Content Fragment Model is published:');
  console.log('   Tools > Assets > Content Fragment Models');
  console.log('4. 🔗 Check if correct endpoint path:');
  console.log('   Current: /content/cq:graphql/jan-cf-models/endpoint.json');
  console.log('   Alternative: /content/cq:graphql/global/endpoint.json');
  console.log('5. 📝 Content Fragment path being used:');
  console.log('  ', path);
  console.log('');
  
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
  if (productData.creditCardImage?._authorUrl || productData.creditCardImage?._path || productData.creditCardImage?._publishUrl) {
    html += '<div class="product-card-image">';
    
    let imageUrl;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isAuthorEnvironment = window.location.hostname.includes('author-');
    
    // For localhost/author: prefer author URLs (what was working before)
    if (isLocalhost || isAuthorEnvironment) {
      if (productData.creditCardImage._authorUrl) {
        imageUrl = productData.creditCardImage._authorUrl;
      } else if (productData.creditCardImage._path) {
        imageUrl = `https://author-p9606-e71941.adobeaemcloud.com${productData.creditCardImage._path}`;
      } else if (productData.creditCardImage._publishUrl) {
        imageUrl = productData.creditCardImage._publishUrl;
      }
    } else {
      // For live environments: prefer publish URLs to avoid CORS
      if (productData.creditCardImage._publishUrl) {
        imageUrl = productData.creditCardImage._publishUrl;
      } else if (productData.creditCardImage._path) {
        imageUrl = `https://publish-p9606-e71941.adobeaemcloud.com${productData.creditCardImage._path}`;
      } else if (productData.creditCardImage._authorUrl) {
        imageUrl = productData.creditCardImage._authorUrl;
      }
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
 * decorate function - simplified like cards block
 */
export default async function decorate(block) {
  const ul = document.createElement('ul');
  
  // Process each row like cards block does
  for (const row of [...block.children]) {
    // Find content fragment path from the row
    const link = row.querySelector('a');
    const contentFragmentPath = link ? link.getAttribute('href') : row.textContent.trim();
    
    if (contentFragmentPath && contentFragmentPath.startsWith('/content')) {
      // Create li like cards block
      const li = document.createElement('li');
      li.className = 'product-card';
      moveInstrumentation(row, li);
      
      try {
        // Fetch content fragment data
        const productData = await fetchContentFragment(contentFragmentPath);
        if (productData) {
          li.innerHTML = createProductCardHTML(productData);
        } else {
          li.innerHTML = `<div class="product-card-body"><h3>No Data</h3><p>Content fragment not found: ${contentFragmentPath}</p></div>`;
        }
      } catch (error) {
        li.innerHTML = `<div class="product-card-body"><h3>Error</h3><p>${error.message}</p></div>`;
      }
      
      ul.append(li);
    }
  }
  
  // Clear block and append ul like cards block
  block.textContent = '';
  block.append(ul);
}