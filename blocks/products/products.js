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
          productId: '',
          creditCardName: '',
          creditCardImage: '',
          creditCardImageAlt: '',
          creditCardDescription: '',
          promo: '',
          notes: '',
          ctaText: 'Find out more',
          ctaLink: '#'
        };

        // Extract content fragment fields from structured content
        const sections = main.querySelectorAll('div');
        
        // Look for field patterns in divs or direct content
        for (const section of sections) {
          const content = section.textContent.trim();
          const prevElement = section.previousElementSibling;
          
          if (prevElement && prevElement.tagName) {
            const label = prevElement.textContent.toLowerCase().trim();
            
            if (label.includes('productid') || label.includes('product-id')) {
              productData.productId = content;
            } else if (label.includes('creditcardname') || label.includes('credit-card-name')) {
              productData.creditCardName = content;
            } else if (label.includes('creditcarddescription') || label.includes('credit-card-description')) {
              productData.creditCardDescription = content;
            } else if (label.includes('promo')) {
              productData.promo = content;
            } else if (label.includes('notes')) {
              productData.notes = content;
            }
          }
        }

        // Alternative parsing - look for structured content in tables or lists
        const tables = main.querySelectorAll('table tr');
        for (const row of tables) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const label = cells[0].textContent.toLowerCase().trim();
            const value = cells[1].textContent.trim();
            
            if (label.includes('productid') || label === 'product id') {
              productData.productId = value;
            } else if (label.includes('creditcardname') || label === 'credit card name') {
              productData.creditCardName = value;
            } else if (label.includes('creditcarddescription') || label === 'credit card description') {
              productData.creditCardDescription = value;
            } else if (label.includes('promo')) {
              productData.promo = value;
            } else if (label.includes('notes')) {
              productData.notes = value;
            }
          }
        }

        // Fallback: extract from headings and subsequent content
        const headings = main.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const heading of headings) {
          const headingText = heading.textContent.toLowerCase().trim();
          let nextElement = heading.nextElementSibling;
          
          if (headingText.includes('product') && headingText.includes('id')) {
            if (nextElement) productData.productId = nextElement.textContent.trim();
          } else if (headingText.includes('credit') && headingText.includes('name')) {
            if (nextElement) productData.creditCardName = nextElement.textContent.trim();
          } else if (headingText.includes('description')) {
            if (nextElement) productData.creditCardDescription = nextElement.textContent.trim();
          } else if (headingText.includes('promo')) {
            if (nextElement) productData.promo = nextElement.textContent.trim();
          } else if (headingText.includes('notes')) {
            if (nextElement) productData.notes = nextElement.textContent.trim();
          }
        }

        // Extract credit card image - look for image with credit card in path or alt text
        const images = main.querySelectorAll('img');
        for (const img of images) {
          const src = img.src || '';
          const alt = img.alt || '';
          if (src.toLowerCase().includes('card') || alt.toLowerCase().includes('card')) {
            productData.creditCardImage = src;
            productData.creditCardImageAlt = alt || productData.creditCardName;
            break;
          }
        }

        // If no specific image found, use the first image
        if (!productData.creditCardImage && images.length > 0) {
          productData.creditCardImage = images[0].src;
          productData.creditCardImageAlt = images[0].alt || productData.creditCardName;
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
  card.setAttribute('data-product-id', productData.productId || '');

  // Create image section
  if (productData.creditCardImage) {
    const imageDiv = document.createElement('div');
    imageDiv.className = 'product-card-image';
    
    const optimizedPic = createOptimizedPicture(
      productData.creditCardImage, 
      productData.creditCardImageAlt || productData.creditCardName, 
      false, 
      [{ width: '400' }]
    );
    imageDiv.appendChild(optimizedPic);
    card.appendChild(imageDiv);
  }

  // Create content section
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'product-card-body';

  // Credit card name as title
  if (productData.creditCardName) {
    const title = document.createElement('h3');
    title.className = 'product-title';
    title.textContent = productData.creditCardName;
    bodyDiv.appendChild(title);
  }

  // Credit card description
  if (productData.creditCardDescription) {
    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = productData.creditCardDescription;
    bodyDiv.appendChild(description);
  }

  // Promo/Special offer section
  if (productData.promo) {
    const promoDiv = document.createElement('div');
    promoDiv.className = 'product-promo';
    
    // Parse promo content for structured information
    const promoLines = productData.promo.split('\n').filter(line => line.trim());
    
    promoLines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check if line looks like a heading (contains "special offer", "rewards", etc.)
      if (trimmedLine.toLowerCase().includes('special offer') || 
          trimmedLine.toLowerCase().includes('rewards special') ||
          (index === 0 && trimmedLine.endsWith(':'))) {
        const heading = document.createElement('h4');
        heading.textContent = trimmedLine;
        promoDiv.appendChild(heading);
      } else {
        const p = document.createElement('p');
        // Handle bold text formatting
        const formattedText = trimmedLine
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
        p.innerHTML = formattedText;
        promoDiv.appendChild(p);
      }
    });
    
    bodyDiv.appendChild(promoDiv);
  }

  // Notes section (additional benefits/features)
  if (productData.notes) {
    const notesDiv = document.createElement('div');
    notesDiv.className = 'product-notes';
    
    const notesLines = productData.notes.split('\n').filter(line => line.trim());
    let currentSection = null;
    
    notesLines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Check if line is a section heading
      if (trimmedLine.toLowerCase().includes('important') || 
          trimmedLine.toLowerCase().includes('numbers') ||
          trimmedLine.toLowerCase().includes('qantas') ||
          trimmedLine.toLowerCase().includes('velocity') ||
          (trimmedLine.endsWith(':') && !trimmedLine.includes(' - '))) {
        
        // Create new section
        const heading = document.createElement('h4');
        heading.textContent = trimmedLine;
        notesDiv.appendChild(heading);
        
        currentSection = document.createElement('ul');
        notesDiv.appendChild(currentSection);
      } else if (currentSection && trimmedLine) {
        // Add as list item
        const li = document.createElement('li');
        
        // Handle fee/rate formatting
        if (trimmedLine.includes(' - ')) {
          const [label, value] = trimmedLine.split(' - ', 2);
          li.innerHTML = `${label.trim()} - <span class="fee">${value.trim()}</span>`;
        } else {
          // Handle bold text formatting
          const formattedText = trimmedLine
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
          li.innerHTML = formattedText;
        }
        
        currentSection.appendChild(li);
      } else if (trimmedLine && !currentSection) {
        // Standalone paragraph
        const p = document.createElement('p');
        const formattedText = trimmedLine
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
        p.innerHTML = formattedText;
        notesDiv.appendChild(p);
      }
    });
    
    bodyDiv.appendChild(notesDiv);
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
