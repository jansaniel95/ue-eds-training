# Product Block

The Product Block displays product information from content fragments in a card-based layout, similar to the example credit card interface.

## Usage

1. Create a content fragment with your product information
2. Add a Product block to your page
3. Specify the path to your content fragment

## Content Fragment Structure

For optimal display, structure your content fragment with the following sections:

### Basic Structure
```
# Product Title

Product description paragraph explaining the main benefits and features.

## Special Offer (or Rewards Special Offer)
- Key benefit 1 with highlighted terms
- Key benefit 2 with special pricing
- Additional promotional information

## Features (or Key Features)
- Feature 1
- Feature 2  
- Feature 3

## Important Information (or Important Numbers)
- Annual fee - $175
- Purchase rate - 20.99% p.a.
- Minimum credit limit - $3,000
- Minimum income - $30,000 p.a.

[Apply Now](https://example.com/apply)
```

## Visual Features

- ✅ **Card-based layout** with clean shadows and hover effects
- ✅ **Responsive grid** that adapts to different screen sizes
- ✅ **Special offer sections** with highlighted styling
- ✅ **Important information** displayed in structured format
- ✅ **Call-to-action buttons** with professional styling
- ✅ **Feature lists** with bullet points
- ✅ **Image optimization** for product visuals

## Example Content Fragment Paths

```
/content/fragments/products/platinum-card
/content/fragments/products/premium-account
/content/fragments/offers/special-promotion
```

## Block Configuration

The block will automatically parse your content fragment and extract:
- **Title** from H1 or H2 headers
- **Description** from the first substantial paragraph
- **Images** with proper optimization
- **Special offers** from sections containing "special", "offer", or "rewards"
- **Important info** from sections containing "important", "numbers", "fee", or "rate"
- **Features** from any remaining lists
- **Call-to-action** from links in the content

The block creates a professional card layout matching modern web design standards.
