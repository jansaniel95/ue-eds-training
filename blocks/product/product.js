import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Fetches content fragment data from the specified path
 * @param {string} path The path to the content fragment
 * @returns {Object} The parsed content fragment data
 */
async function fetchContentFragment(path) {
  if (!path || !path.startsWith('/')) {
    return null;
  }

  try {
    // Remove any .html extension and add .plain.html for fetching
    const cleanPath = path.replace(/(\.plain)?\.html/, '');
    const resp = await fetch(`${cleanPath}.plain.html`);
    
    if (resp.ok) {
      const text = await resp.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      
      // Extract structured data from the content fragment
      const main = doc.querySelector('main');
      if (main) {
        const productData = {
          title: '',
          description: '',
          image: '',
          imageAlt: '',
          features: [],
          featuresTitle: '',
          specialOffer: null,
          importantInfo: [],
          importantInfoTitle: '',
          ctaText: 'Find out more',
          ctaLink: '#'
        };

        // Try to extract title from h1, h2, or first paragraph
        const titleEl = main.querySelector('h1, h2') || main.querySelector('p');
        if (titleEl) {
          productData.title = titleEl.textContent.trim();
        }

        // Extract image
        const img = main.querySelector('img');
        if (img) {
          productData.image = img.src;
          productData.imageAlt = img.alt || productData.title;
        }

        // Extract all paragraphs and sections
        const allElements = main.querySelectorAll('h1, h2, h3, h4, p, ul, ol');
        let currentSection = '';
        let isSpecialOffer = false;
        let isImportantInfo = false;
        
        for (const element of allElements) {
          const text = element.textContent.trim();
          
          // Skip title element
          if (element === titleEl) continue;
          
          // Check for section headers
          if (element.tagName.match(/^H[2-4]$/)) {
            currentSection = text.toLowerCase();
            isSpecialOffer = currentSection.includes('special') || currentSection.includes('offer') || currentSection.includes('rewards');
            isImportantInfo = currentSection.includes('important') || currentSection.includes('number') || currentSection.includes('fee') || currentSection.includes('rate');
            
            if (isSpecialOffer && !productData.specialOffer) {
              productData.specialOffer = {
                title: text,
                items: []
              };
            }
            
            if (isImportantInfo && !productData.importantInfoTitle) {
              productData.importantInfoTitle = text;
            }
            
            if (currentSection.includes('feature') && !productData.featuresTitle) {
              productData.featuresTitle = text;
            }
            continue;
          }
          
          // Handle paragraphs
          if (element.tagName === 'P') {
            if (isSpecialOffer && productData.specialOffer) {
              productData.specialOffer.items.push(text);
            } else if (isImportantInfo) {
              productData.importantInfo.push(text);
            } else if (!productData.description && text.length > 20) {
              // Use first substantial paragraph as description
              productData.description = text;
            }
          }
          
          // Handle lists
          if (element.tagName === 'UL' || element.tagName === 'OL') {
            const items = element.querySelectorAll('li');
            items.forEach(item => {
              const itemText = item.textContent.trim();
              if (isSpecialOffer && productData.specialOffer) {
                productData.specialOffer.items.push(itemText);
              } else if (isImportantInfo) {
                productData.importantInfo.push(itemText);
              } else {
                productData.features.push(itemText);
              }
            });
          }
        }

        // Look for CTA links
        const ctaLink = main.querySelector('a[href*="apply"], a[href*="learn"], a[href*="more"], a');
        if (ctaLink) {
          productData.ctaText = ctaLink.textContent.trim() || 'Find out more';
          productData.ctaLink = ctaLink.href;
        }

        return productData;
      }
    }
  } catch (error) {
    console.error('Error fetching content fragment:', error);
  }
  
  return null;
}

/**
 * Creates a product card element from content fragment data
 * @param {Object} productData The product data from content fragment
 * @returns {HTMLElement} The product card element
 */
function createProductCard(productData) {
  const card = document.createElement('li');
  card.className = 'product-card';

  // Create image section
  if (productData.image) {
    const imageDiv = document.createElement('div');
    imageDiv.className = 'product-card-image';
    
    const optimizedPic = createOptimizedPicture(productData.image, productData.imageAlt || productData.title, false, [{ width: '400' }]);
    imageDiv.appendChild(optimizedPic);
    card.appendChild(imageDiv);
  }

  // Create content section
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'product-card-body';

  if (productData.title) {
    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = productData.title;
    bodyDiv.appendChild(title);
  }

  if (productData.description) {
    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = productData.description;
    bodyDiv.appendChild(description);
  }

  // Special offer section
  if (productData.specialOffer) {
    const offerDiv = document.createElement('div');
    offerDiv.className = 'product-special-offer';
    
    const offerTitle = document.createElement('h4');
    offerTitle.textContent = productData.specialOffer.title || 'Special Offer:';
    offerDiv.appendChild(offerTitle);
    
    productData.specialOffer.items.forEach(item => {
      const p = document.createElement('p');
      p.innerHTML = item; // Allow for HTML formatting like <strong> tags
      offerDiv.appendChild(p);
    });
    
    bodyDiv.appendChild(offerDiv);
  }

  // Features section
  if (productData.features.length > 0) {
    const featuresDiv = document.createElement('div');
    featuresDiv.className = 'product-features';
    
    const featuresTitle = document.createElement('h4');
    featuresTitle.textContent = productData.featuresTitle || 'Features:';
    featuresDiv.appendChild(featuresTitle);
    
    const featuresList = document.createElement('ul');
    productData.features.forEach(feature => {
      const li = document.createElement('li');
      li.textContent = feature;
      featuresList.appendChild(li);
    });
    featuresDiv.appendChild(featuresList);
    bodyDiv.appendChild(featuresDiv);
  }

  // Important information section
  if (productData.importantInfo.length > 0) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'product-important-info';
    
    const infoTitle = document.createElement('h4');
    infoTitle.textContent = productData.importantInfoTitle || 'Important Information:';
    infoDiv.appendChild(infoTitle);
    
    const infoList = document.createElement('ul');
    productData.importantInfo.forEach(info => {
      const li = document.createElement('li');
      if (info.includes(' - ')) {
        const [label, value] = info.split(' - ');
        li.innerHTML = `${label} - <span class="fee">${value}</span>`;
      } else {
        li.textContent = info;
      }
      infoList.appendChild(li);
    });
    infoDiv.appendChild(infoList);
    bodyDiv.appendChild(infoDiv);
  }

  // Call-to-action button
  const ctaDiv = document.createElement('div');
  ctaDiv.className = 'product-cta';
  
  const ctaButton = document.createElement('a');
  ctaButton.className = 'product-cta-button';
  ctaButton.textContent = productData.ctaText || 'Find out more';
  ctaButton.href = productData.ctaLink || '#';
  ctaDiv.appendChild(ctaButton);
  
  bodyDiv.appendChild(ctaDiv);
  card.appendChild(bodyDiv);
  return card;
}

/**
 * Decorates the product block
 * @param {Element} block The product block element
 */
export default async function decorate(block) {
  // Convert to ul structure like cards block
  const ul = document.createElement('ul');
  ul.className = 'product-grid';

  // Process each product item
  const items = [...block.children];
  for (const row of items) {
    moveInstrumentation(row, ul);
    
    // Find content fragment path
    const link = row.querySelector('a');
    const pathText = row.textContent.trim();
    const contentFragmentPath = link ? link.getAttribute('href') : pathText;

    if (contentFragmentPath) {
      try {
        const productData = await fetchContentFragment(contentFragmentPath);
        if (productData) {
          const productCard = createProductCard(productData);
          moveInstrumentation(row, productCard);
          ul.appendChild(productCard);
        } else {
          // Fallback: create a card with error message
          const errorCard = document.createElement('li');
          errorCard.className = 'product-card product-error';
          errorCard.innerHTML = `
            <div class="product-card-body">
              <h3>Product Not Found</h3>
              <p>Could not load product data from: ${contentFragmentPath}</p>
            </div>
          `;
          moveInstrumentation(row, errorCard);
          ul.appendChild(errorCard);
        }
      } catch (error) {
        console.error('Error processing product item:', error);
      }
    }
  }

  // Replace block content with the new structure
  block.textContent = '';
  block.appendChild(ul);
}
