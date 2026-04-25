const overlay = document.getElementById('overlayPanel');
const closePanel = document.getElementById('closePanel');
const overlayBackdrop = document.getElementById('overlayBackdrop');
const root = document.getElementById('collections-root');

function openPanel(options = {}) {
  if (overlay.classList.contains('is-open')) return;
  overlay.classList.add('is-open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (!options.silent) {
    window.dispatchEvent(new CustomEvent('distcs:overlay-open'));
  }
}

function closeOverlay(options = {}) {
  if (document.body.classList.contains('mobile-only')) return;
  if (!overlay.classList.contains('is-open')) return;
  overlay.classList.remove('is-open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (!options.silent) {
    window.dispatchEvent(new CustomEvent('distcs:overlay-close'));
  }
}

window.distOpenOverlay = openPanel;
window.distCloseOverlay = closeOverlay;

closePanel.addEventListener('click', closeOverlay);
overlayBackdrop.addEventListener('click', closeOverlay);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
    closeOverlay();
  }
});

document.querySelectorAll('.anchor-nav a').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const id = link.getAttribute('href');
    const target = document.querySelector(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const collections = [
  {
    title: 'Spatial Curvatures',
    editionSize: 200,
    previewCount: 6,
    mode: 'artblocks',
    chainId: '1',
    contractAddress: '0x32d4be5ee74376e08038d652d4dc26e62c67f436',
    firstTokenId: 7000001,
    description: 'Preview images load directly into the page. Full collection expands in-place.'
  },
  {
    title: 'Mina',
    editionSize: 150,
    previewCount: 6,
    mode: 'tzkt',
    tezosContract: 'KT1KEa8z6vWXDJrVqtMrAeDVzsvxat3kHaCE',
    description: 'Preview images load directly from token metadata and IPFS.'
  },
  {
    title: 'Deconstructions',
    editionSize: 300,
    previewCount: 6,
    mode: 'tzkt',
    tezosContract: 'KT1U6EHmNxJTkvaWJ4ThczG4FSDaHC21ssvi',
    description: 'Preview images load directly from token metadata and IPFS.'
  }
];

function buildArtBlocksImageUrl(collection, tokenId) {
  return `https://media-proxy.artblocks.io/${collection.chainId}/${collection.contractAddress}/${tokenId}.png`;
}

function normalizeIpfs(uri) {
  if (!uri || typeof uri !== 'string') return '';

  const cleaned = uri.trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('ipfs://ipfs/')) return `https://ipfs.io/ipfs/${cleaned.replace('ipfs://ipfs/', '')}`;
  if (cleaned.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${cleaned.replace('ipfs://', '')}`;
  if (/^(Qm[1-9A-Za-z]{44}|bafy[1-9A-Za-z]+)/.test(cleaned)) return `https://ipfs.io/ipfs/${cleaned}`;
  return cleaned;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setImageSource(img, sources) {
  const queue = sources.filter(Boolean);

  function tryNext() {
    if (!queue.length) {
      img.classList.add('image-fallback');
      img.src = 'assets/placeholder-square.svg';
      return;
    }
    img.src = queue.shift();
  }

  img.addEventListener('error', tryNext);
  tryNext();
}

function createImg(sources, alt) {
  const img = document.createElement('img');
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  setImageSource(img, Array.isArray(sources) ? sources : [sources]);
  return img;
}

async function appendImagesInBatches(gallery, items, batchSize = 18, pauseMs = 120) {
  gallery.innerHTML = '';

  for (let index = 0; index < items.length; index += batchSize) {
    const fragment = document.createDocumentFragment();
    const slice = items.slice(index, index + batchSize);

    slice.forEach((item) => {
      fragment.appendChild(createImg(item.sources, item.alt));
    });

    gallery.appendChild(fragment);
    if (index + batchSize < items.length) {
      await wait(pauseMs);
    }
  }
}

function getTokenImage(token) {
  const metadata = token?.metadata || {};
  const formats = Array.isArray(metadata.formats) ? metadata.formats : [];
  const formatUris = formats
    .map((format) => normalizeIpfs(format?.uri || format?.fileName || ''))
    .filter(Boolean);

  const primary = normalizeIpfs(
    metadata.displayUri ||
    metadata.display_uri ||
    metadata.thumbnailUri ||
    metadata.thumbnail_uri ||
    metadata.image ||
    metadata.imageUri ||
    metadata.image_uri ||
    metadata.artifactUri ||
    metadata.artifact_uri ||
    token?.displayUri ||
    token?.display_uri ||
    token?.thumbnailUri ||
    token?.thumbnail_uri ||
    token?.artifactUri ||
    token?.artifact_uri
  );

  return [primary, ...formatUris].filter(Boolean);
}

function tokenBelongsToCollection(token, collectionTitle) {
  const metadata = token?.metadata || {};
  const title = String(
    metadata.name || metadata.title || token?.name || token?.title || ''
  ).trim().toLowerCase();

  return title.startsWith(collectionTitle.toLowerCase());
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

async function fetchTzktTokensForCollection(collection) {
  const limit = 1000;
  const encodedPattern = encodeURIComponent(`${collection.title}*`);
  const urls = [
    `https://api.tzkt.io/v1/tokens?contract=${collection.tezosContract}&limit=${limit}&sort.asc=tokenId&metadata.name.as=${encodedPattern}`,
    `https://api.tzkt.io/v1/tokens?contract=${collection.tezosContract}&limit=${limit}&sort.asc=tokenId&name.as=${encodedPattern}`,
    `https://api.tzkt.io/v1/tokens?contract=${collection.tezosContract}&limit=${limit}&sort.asc=tokenId`
  ];

  for (const url of urls) {
    try {
      const payload = await fetchJson(url);
      if (!Array.isArray(payload)) continue;

      const filtered = payload.filter((token) => tokenBelongsToCollection(token, collection.title));
      if (filtered.length) return filtered;

      if (url.endsWith('sort.asc=tokenId') && payload.length && payload.every((token) => tokenBelongsToCollection(token, collection.title))) {
        return payload;
      }
    } catch (error) {
      console.warn(`TzKT request failed for ${collection.title}`, error);
    }
  }

  throw new Error(`No tokens resolved for ${collection.title}`);
}

function createCollectionCard(collection) {
  const article = document.createElement('article');
  article.className = 'collection-block';

  article.innerHTML = `
    <div class="collection-header">
      <div class="collection-copy">
        <h3>${collection.title}</h3>
        <div class="collection-meta">
          <span><span class="meta-label">Edition size</span><span class="edition-value">${collection.editionSize}</span></span>
        </div>
      </div>
      <div class="collection-copy">
        <p>${collection.description}</p>
        <p class="collection-status" data-status>Loading preview…</p>
      </div>
      <div>
        <button class="collection-button" data-load-all type="button">Load full collection</button>
      </div>
    </div>
    <div class="collection-gallery" data-gallery></div>
    <div class="collection-footer" data-footer hidden>
      <button class="collection-button collection-button-minimize" data-minimize type="button">Minimize</button>
    </div>
  `;

  const gallery = article.querySelector('[data-gallery]');
  const status = article.querySelector('[data-status]');
  const editionValue = article.querySelector('.edition-value');
  const loadAllButton = article.querySelector('[data-load-all]');
  const footer = article.querySelector('[data-footer]');
  const minimizeButton = article.querySelector('[data-minimize]');

  let isExpanded = false;

  function setExpandedState(expanded) {
    isExpanded = expanded;

    if (expanded) {
      loadAllButton.hidden = true;
      footer.hidden = false;
    } else {
      loadAllButton.hidden = false;
      loadAllButton.disabled = false;
      loadAllButton.textContent = 'Load full collection';
      footer.hidden = true;
    }
  }

  async function renderArtBlocks(all = false) {
    const total = all ? collection.editionSize : collection.previewCount;
    status.textContent = all
      ? `Loading all ${collection.editionSize} outputs…`
      : `Loading ${collection.previewCount} preview outputs…`;

    const items = Array.from({ length: total }, (_, i) => {
      const tokenId = collection.firstTokenId + i;
      return {
        alt: `${collection.title} ${i + 1}`,
        sources: [buildArtBlocksImageUrl(collection, tokenId)]
      };
    });

    await appendImagesInBatches(gallery, items, all ? 16 : items.length, all ? 140 : 0);
    status.textContent = all
      ? `Showing all ${collection.editionSize} outputs.`
      : `Showing ${collection.previewCount} preview outputs.`;
  }

  async function renderTzkt(all = false) {
    const wanted = all ? collection.editionSize : collection.previewCount;
    status.textContent = all ? 'Loading full collection…' : 'Loading preview…';

    try {
      const tokens = await fetchTzktTokensForCollection(collection);
      const usable = tokens
        .filter((token) => getTokenImage(token).length)
        .slice(0, wanted);

      if (!usable.length) {
        throw new Error(`No image-bearing tokens resolved for ${collection.title}`);
      }

      const items = usable.map((token, index) => ({
        alt: `${collection.title} ${index + 1}`,
        sources: getTokenImage(token)
      }));

      editionValue.textContent = collection.editionSize;
      await appendImagesInBatches(gallery, items, all ? 18 : items.length, all ? 120 : 0);

      status.textContent = all
        ? `Showing ${items.length} outputs loaded from token metadata.`
        : `Showing ${items.length} preview outputs loaded from token metadata.`;

      if (all && items.length < collection.editionSize) {
        status.textContent += ` ${collection.editionSize - items.length} outputs could not be resolved from the current public metadata response.`;
      }
    } catch (error) {
      gallery.innerHTML = '';
      const fallbackCount = all ? 12 : collection.previewCount;
      for (let i = 0; i < fallbackCount; i += 1) {
        gallery.appendChild(createImg('assets/placeholder-square.svg', `${collection.title} placeholder ${i + 1}`));
      }
      status.textContent = 'Direct token preview images could not be resolved in-browser from the current public metadata source.';
      console.error(error);
    }
  }

  async function renderPreview() {
    setExpandedState(false);

    if (collection.mode === 'artblocks') {
      return renderArtBlocks(false);
    }

    if (collection.mode === 'tzkt') {
      return renderTzkt(false);
    }
  }

  async function renderFullCollection() {
    loadAllButton.disabled = true;
    loadAllButton.textContent = 'Loading…';

    if (collection.mode === 'artblocks') {
      await renderArtBlocks(true);
    }

    if (collection.mode === 'tzkt') {
      await renderTzkt(true);
    }

    setExpandedState(true);
  }

  loadAllButton.addEventListener('click', async () => {
    await renderFullCollection();
  });

  minimizeButton.addEventListener('click', async () => {
    await renderPreview();
  });

  renderPreview();
  return article;
}

if (root && !document.getElementById('generative-systems')?.hasAttribute('hidden')) {
  collections.forEach((collection) => root.appendChild(createCollectionCard(collection)));
}

