import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Simple GraphQL fetch for credit card content fragments
 */
async function fetchContentFragment(path) {
  const graphqlUrl = 'https://author-p9606-e71941.adobeaemcloud.com/content/cq:graphql/your-project/endpoint.json';
  
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

    if (response.ok) {
      const data = await response.json();
      
      if (data.data && data.data.creditCardList && data.data.creditCardList.items) {
        const item = data.data.creditCardList.items.find(item => item._path === path);
        return item || null;
      }
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
    
    if (productData.creditCardImage._authorUrl) {
      html += `<picture><img src="${productData.creditCardImage._authorUrl}" alt="${productData.creditCardName || 'Credit Card'}" loading="lazy"></picture>`;
    } else {
      const imageUrl = `https://author-p9606-e71941.adobeaemcloud.com${productData.creditCardImage._path}`;
      html += `<picture><img src="${imageUrl}" alt="${productData.creditCardName || 'Credit Card'}" loading="lazy"></picture>`;
    }
    
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
        li.innerHTML = createProductCardHTML(productData);
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