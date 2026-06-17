export type CartersProduct = {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  sku: string;
};

export const CARTERS_PRODUCTS: CartersProduct[] = [
  // Little Planet (Organic Line)
  { id: "LP001", name: "Little Planet™ Organic Sleep & Play Pajamas (3-pack)", category: "Pajamas", subcategory: "Little Planet", sku: "LP-SPP-3PK" },
  { id: "LP002", name: "Little Planet™ Organic Cotton Gauze Overall", category: "Bottoms", subcategory: "Little Planet", sku: "LP-OVR-001" },
  { id: "LP003", name: "Little Planet™ Organic Bodysuit (5-pack)", category: "Bodysuits", subcategory: "Little Planet", sku: "LP-BOD-5PK" },
  { id: "LP004", name: "Little Planet™ Organic Sweater Knit Set", category: "Outfit Sets", subcategory: "Little Planet", sku: "LP-SKS-001" },
  { id: "LP005", name: "Little Planet™ Organic Hooded Towel", category: "Accessories", subcategory: "Little Planet", sku: "LP-TWL-001" },
  { id: "LP006", name: "Little Planet™ Organic Crib Sheet (2-pack)", category: "Baby Gear", subcategory: "Little Planet", sku: "LP-CRS-2PK" },
  { id: "LP007", name: "Little Planet™ Organic Footed Pajamas", category: "Pajamas", subcategory: "Little Planet", sku: "LP-FTP-001" },
  { id: "LP008", name: "Little Planet™ Recycled Swim Trunk", category: "Swim", subcategory: "Little Planet", sku: "LP-SWT-001" },

  // Pajamas
  { id: "PJ001", name: "5-Star Zip-Up Sleep & Play Pajamas", category: "Pajamas", subcategory: "Sleep & Play", sku: "CRT-5STAR-ZP" },
  { id: "PJ002", name: "PurelySoft™ Footed Pajamas", category: "Pajamas", subcategory: "PurelySoft", sku: "CRT-PSF-FTP" },
  { id: "PJ003", name: "Snug Fit Cotton Pajama Set (2-piece)", category: "Pajamas", subcategory: "Snug Fit", sku: "CRT-SNF-2PC" },
  { id: "PJ004", name: "Fleece Loose Fit Pajama Set (2-piece)", category: "Pajamas", subcategory: "Fleece", sku: "CRT-FLC-2PC" },
  { id: "PJ005", name: "2-Way Zip Footie Pajamas", category: "Pajamas", subcategory: "Sleep & Play", sku: "CRT-2WZ-FTP" },
  { id: "PJ006", name: "DreamPlush™ Snug Fit Pajama Set", category: "Pajamas", subcategory: "DreamPlush", sku: "CRT-DPL-SNF" },
  { id: "PJ007", name: "Cotton Snug Fit Pajamas (4-piece)", category: "Pajamas", subcategory: "Snug Fit", sku: "CRT-SNF-4PK" },

  // Bodysuits
  { id: "BD001", name: "Short-Sleeve Bodysuit (5-pack)", category: "Bodysuits", subcategory: "Short Sleeve", sku: "CRT-SS-BOD-5PK" },
  { id: "BD002", name: "Long-Sleeve Bodysuit (4-pack)", category: "Bodysuits", subcategory: "Long Sleeve", sku: "CRT-LS-BOD-4PK" },
  { id: "BD003", name: "Sleeveless Bodysuit Multipack", category: "Bodysuits", subcategory: "Sleeveless", sku: "CRT-SLV-BOD-MPK" },
  { id: "BD004", name: "Snap-Up Cotton Bodysuit (3-pack)", category: "Bodysuits", subcategory: "Snap-Up", sku: "CRT-SUP-BOD-3PK" },
  { id: "BD005", name: "Side-Snap Bodysuit (Newborn)", category: "Bodysuits", subcategory: "Newborn", sku: "CRT-SSN-BOD-NB" },

  // Outfit Sets
  { id: "OS001", name: "2-Piece Bodysuit & Pant Set", category: "Outfit Sets", subcategory: "2-Piece", sku: "CRT-2PC-BPS" },
  { id: "OS002", name: "3-Piece Bodysuit, Pant & Hat Set", category: "Outfit Sets", subcategory: "3-Piece", sku: "CRT-3PC-BPH" },
  { id: "OS003", name: "5-Piece Essentials Gift Set", category: "Outfit Sets", subcategory: "Gift Sets", sku: "CRT-5PC-GFT" },
  { id: "OS004", name: "Sherpa 3-Piece Bodysuit Pant Set", category: "Outfit Sets", subcategory: "Sherpa", sku: "CRT-SHR-3PC" },
  { id: "OS005", name: "Fleece Coverall & Hat Set", category: "Outfit Sets", subcategory: "Coverall", sku: "CRT-FLC-CVR" },

  // Tops
  { id: "TP001", name: "Graphic Tee (2-pack)", category: "Tops", subcategory: "Graphic Tees", sku: "CRT-GFX-TEE-2PK" },
  { id: "TP002", name: "Long-Sleeve Thermal Henley", category: "Tops", subcategory: "Thermal", sku: "CRT-THM-HNL" },
  { id: "TP003", name: "Striped Pocket Tee", category: "Tops", subcategory: "Tees", sku: "CRT-STR-PKT" },
  { id: "TP004", name: "Hooded Sweatshirt", category: "Tops", subcategory: "Sweatshirts", sku: "CRT-HOD-SWT" },
  { id: "TP005", name: "Fleece Pullover Sweatshirt", category: "Tops", subcategory: "Sweatshirts", sku: "CRT-FLC-PUL" },

  // Bottoms
  { id: "BT001", name: "Pull-On Knit Pants (2-pack)", category: "Bottoms", subcategory: "Pants", sku: "CRT-KNT-PNT-2PK" },
  { id: "BT002", name: "Stretch Denim Jean", category: "Bottoms", subcategory: "Jeans", sku: "CRT-STR-JEN" },
  { id: "BT003", name: "Fleece Jogger Pant", category: "Bottoms", subcategory: "Joggers", sku: "CRT-FLC-JOG" },
  { id: "BT004", name: "Pull-On Shorts (2-pack)", category: "Bottoms", subcategory: "Shorts", sku: "CRT-PUL-SHT-2PK" },
  { id: "BT005", name: "Woven Cargo Short", category: "Bottoms", subcategory: "Shorts", sku: "CRT-WVN-CGO" },

  // Dresses & Rompers
  { id: "DR001", name: "Floral Jersey Dress", category: "Dresses & Rompers", subcategory: "Dresses", sku: "CRT-FLR-DRS" },
  { id: "DR002", name: "Sleeveless Romper", category: "Dresses & Rompers", subcategory: "Rompers", sku: "CRT-SLV-RMP" },
  { id: "DR003", name: "Smocked Woven Dress", category: "Dresses & Rompers", subcategory: "Dresses", sku: "CRT-SMK-DRS" },
  { id: "DR004", name: "Knit Shortall", category: "Dresses & Rompers", subcategory: "Shortalls", sku: "CRT-KNT-SHL" },

  // Outerwear
  { id: "OW001", name: "Heavyweight Puffer Jacket", category: "Outerwear", subcategory: "Jackets", sku: "CRT-HVY-PUF" },
  { id: "OW002", name: "Fleece Zip-Up Hoodie", category: "Outerwear", subcategory: "Hoodies", sku: "CRT-FLC-ZUP" },
  { id: "OW003", name: "Water-Resistant Rain Jacket", category: "Outerwear", subcategory: "Rain Jackets", sku: "CRT-WTR-RJK" },
  { id: "OW004", name: "Sherpa-Lined Denim Jacket", category: "Outerwear", subcategory: "Jackets", sku: "CRT-SHR-DNM" },

  // Swim
  { id: "SW001", name: "UPF 50+ Rash Guard Set", category: "Swim", subcategory: "Rash Guards", sku: "CRT-UPF-RGS" },
  { id: "SW002", name: "One-Piece Swimsuit", category: "Swim", subcategory: "One-Piece", sku: "CRT-1PC-SWM" },
  { id: "SW003", name: "Swim Trunk (2-pack)", category: "Swim", subcategory: "Trunks", sku: "CRT-SWT-2PK" },

  // Accessories
  { id: "AC001", name: "Cotton Sock Multipack (8-pack)", category: "Accessories", subcategory: "Socks", sku: "CRT-SCK-8PK" },
  { id: "AC002", name: "Beanie & Mitten Set", category: "Accessories", subcategory: "Hats & Mittens", sku: "CRT-BNE-MIT" },
  { id: "AC003", name: "Adjustable Canvas Shoe", category: "Shoes", subcategory: "Casual", sku: "CRT-CNV-SHO" },
  { id: "AC004", name: "Slip-On Sneaker", category: "Shoes", subcategory: "Sneakers", sku: "CRT-SLP-SNK" },
];

export const LP001_DEMO_ID = "LP001";

export function formatCartersCategory(product: CartersProduct): string {
  return `${product.subcategory} · ${product.category}`;
}

export function filterCartersProducts(query: string, limit = 8): CartersProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return CARTERS_PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.subcategory.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q),
  ).slice(0, limit);
}
