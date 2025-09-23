import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Simple GraphQL fetch for credit card content fragments
 */
async function fetchContentFragment(path) {
  console.log('Fetching content fragment:', path);
  
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

    console.log('GraphQL Response:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('GraphQL Data:', data);
      
      // Find the item that matches our path
      if (data.data && data.data.creditCardList && data.data.creditCardList.items) {
        const item = data.data.creditCardList.items.find(item => item._path === path);
        if (item) {
          console.log('Found matching item:', item);
          return item;
        } else {
          console.log('No item found for path:', path);
          console.log('Available items:', data.data.creditCardList.items.map(i => i._path));
        }
      }
    } else {
      console.error('GraphQL failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('Fetch error:', error);
  }
  
  return null;
}

/**
 * Create credit card product card matching the design
 */
function createProductCard(productData) {
  if (!productData || productData.error) {
    const errorCard = document.createElement('li');
    errorCard.className = 'product-card product-error';
    errorCard.innerHTML = `
      <div class="product-card-body">
        <h3>Error</h3>
        <p>${productData?.error || 'No data available'}</p>
      </div>
    `;
    return errorCard;
  }

  const card = document.createElement('li');
  card.className = 'product-card';

  // Create image section
  if (productData.creditCardImage?._authorUrl || productData.creditCardImage?._path) {
    const imageDiv = document.createElement('div');
    imageDiv.className = 'product-card-image';
    
    if (productData.creditCardImage._authorUrl) {
      // Use _authorUrl directly as it already has optimized parameters
      const picture = document.createElement('picture');
      const img = document.createElement('img');
      img.src = productData.creditCardImage._authorUrl;
      img.srcset = productData.creditCardImage._authorUrl;
      img.alt = productData.creditCardName || 'Credit Card';
      img.loading = 'lazy';
      picture.appendChild(img);
      imageDiv.appendChild(picture);
    } else {
      // Fallback to _path with manual optimization
      const imageUrl = `https://author-p9606-e71941.adobeaemcloud.com${productData.creditCardImage._path}`;
      const optimizedPic = createOptimizedPicture(imageUrl, productData.creditCardName || 'Credit Card', false, [{ width: '400' }]);
      imageDiv.appendChild(optimizedPic);
    }
    
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
  if (productData.creditCardDescription?.plaintext) {
    const description = document.createElement('p');
    description.className = 'product-description';
    description.textContent = productData.creditCardDescription.plaintext;
    bodyDiv.appendChild(description);
  }

  // Promo section
  if (productData.promo?.plaintext) {
    const promoDiv = document.createElement('div');
    promoDiv.className = 'product-promo';
    
    const promoText = productData.promo.plaintext;
    const promoLines = promoText.split('\n').filter(line => line.trim());
    
    promoLines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Check if line is a heading
      if (trimmedLine.toLowerCase().includes('special offer') || 
          trimmedLine.toLowerCase().includes('rewards special') ||
          trimmedLine.toLowerCase().includes('already with') ||
          (trimmedLine.endsWith(':') && !trimmedLine.includes(' - '))) {
        const heading = document.createElement('h4');
        heading.textContent = trimmedLine;
        promoDiv.appendChild(heading);
      } else if (trimmedLine) {
        // Regular paragraph with number highlighting
        const p = document.createElement('p');
        
        // Highlight numbers, dollar amounts, and percentages
        let formattedText = trimmedLine
          .replace(/(\d{1,3}(?:,\d{3})*)/g, '<strong>$1</strong>') // Numbers with commas
          .replace(/(\$\d+)/g, '<strong>$1</strong>') // Dollar amounts
          .replace(/(\d+(?:\.\d+)?%)/g, '<strong>$1</strong>') // Percentages
          .replace(/(\$\d+ foreign transaction fees)/g, '<strong>$1</strong>'); // Special phrases
        
        p.innerHTML = formattedText;
        promoDiv.appendChild(p);
      }
    });
    
    bodyDiv.appendChild(promoDiv);
  }

  // Notes section
  if (productData.notes?.plaintext) {
    const notesDiv = document.createElement('div');
    notesDiv.className = 'product-notes';
    
    const notesText = productData.notes.plaintext;
    const notesLines = notesText.split('\n').filter(line => line.trim());
    
    let currentSection = null;
    
    notesLines.forEach(line => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toLowerCase().includes('important') || 
          trimmedLine.toLowerCase().includes('numbers') ||
          (trimmedLine.endsWith(':') && !trimmedLine.includes(' - '))) {
        // This is a heading
        const heading = document.createElement('h4');
        heading.textContent = trimmedLine;
        notesDiv.appendChild(heading);
        
        currentSection = document.createElement('ul');
        notesDiv.appendChild(currentSection);
      } else if (currentSection && trimmedLine) {
        // Add as list item
        const li = document.createElement('li');
        
        if (trimmedLine.includes(' - ')) {
          const [label, value] = trimmedLine.split(' - ', 2);
          li.innerHTML = `${label.trim()} - <span class="fee">${value.trim()}</span>`;
        } else {
          li.textContent = trimmedLine;
        }
        
        currentSection.appendChild(li);
      } else if (trimmedLine && !currentSection) {
        // Standalone paragraph
        const p = document.createElement('p');
        p.textContent = trimmedLine;
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
  ctaButton.textContent = 'Find out more';
  ctaButton.href = '#';
  ctaDiv.appendChild(ctaButton);
  
  bodyDiv.appendChild(ctaDiv);
  card.appendChild(bodyDiv);
  return card;
}


/**
 * Decorates the products block
 */
export default async function decorate(block) {
  // Check if first row is a title
  const rows = [...block.children];
  let titleRow = null;
  let productRows = rows;
  
  // If first row has only one cell with text (no links), treat it as title
  if (rows.length > 0) {
    const firstRow = rows[0];
    const cells = firstRow.querySelectorAll('div');
    if (cells.length === 1 && !firstRow.querySelector('a') && cells[0].textContent.trim()) {
      titleRow = firstRow;
      productRows = rows.slice(1);
    }
  }

  // Create title section if exists
  if (titleRow) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'products-title';
    const titleText = titleRow.textContent.trim();
    titleDiv.innerHTML = `<h2>${titleText}</h2>`;
    block.prepend(titleDiv);
  }

  // Convert to ul structure like cards block
  const ul = document.createElement('ul');
  console.log('Found', productRows.length, 'product items');
  
  for (const row of productRows) {
    // Find content fragment path
    const link = row.querySelector('a');
    const contentFragmentPath = link ? link.getAttribute('href') : row.textContent.trim();
    
    console.log('Processing content fragment path:', contentFragmentPath);

    if (contentFragmentPath) {
      try {
        const productData = await fetchContentFragment(contentFragmentPath);
        const productCard = createProductCard(productData || { error: `Failed to fetch: ${contentFragmentPath}` });
        moveInstrumentation(row, productCard);
        ul.appendChild(productCard);
      } catch (error) {
        console.error('Error processing product item:', error);
        const errorCard = createProductCard({ error: `Error: ${error.message}` });
        ul.appendChild(errorCard);
      }
    }
  }

  // Remove original rows and append the new structure
  productRows.forEach(row => row.remove());
  if (titleRow) titleRow.remove();
  
  block.appendChild(ul);
}
