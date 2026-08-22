// Chalk & Cover — shared front-end behaviour
(function () {
  'use strict';

  const CART_KEY = 'chalkCoverCart';
  const WISHLIST_KEY = 'chalkCoverWishlist';
  const AUTH_KEY = 'chalkCoverAuth';
  const RETURN_KEY = 'chalkCoverReturnTo';
  const CART_ICON = '<svg class="icon-svg" width="15" height="15" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"></path></svg>';
  const HEART_ICON = '<svg class="icon-svg" width="14" height="14" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"></path></svg>';

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  function money(value) {
    return '₹' + Number(value || 0).toLocaleString('en-IN');
  }

  function slug(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function getCart() { return read(CART_KEY, []); }
  function getWishlist() { return read(WISHLIST_KEY, []); }
  function isLoggedIn() { return !!localStorage.getItem(AUTH_KEY); }
  function requireLogin(nextUrl) {
    localStorage.setItem(RETURN_KEY, nextUrl || 'checkout.html');
    window.location.href = 'login.html';
  }

  function cartCount() {
    return getCart().reduce((sum, item) => sum + Number(item.qty || 0), 0);
  }

  function updateCartBadges() {
    document.querySelectorAll('.cart-badge').forEach(badge => badge.textContent = cartCount());
  }

  function toast(message) {
    let node = document.querySelector('.site-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'site-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(window.__ccToastTimer);
    window.__ccToastTimer = setTimeout(() => node.classList.remove('show'), 1800);
  }

  function addToCart(data) {
    const cart = getCart();
    const existing = cart.find(item => item.id === data.id);
    if (existing) existing.qty += 1;
    else cart.push({ ...data, qty: 1 });
    write(CART_KEY, cart);
    updateCartBadges();
    toast(data.name + ' added to cart');
  }

  function toggleWishlist(data, button) {
    let wishlist = getWishlist();
    const index = wishlist.findIndex(item => item.id === data.id);
    if (index >= 0) {
      wishlist.splice(index, 1);
      button.classList.remove('is-wishlisted');
      button.setAttribute('aria-label', 'Add to wishlist');
      button.title = 'Add to wishlist';
      toast('Removed from wishlist');
    } else {
      wishlist.push(data);
      button.classList.add('is-wishlisted');
      button.setAttribute('aria-label', 'Remove from wishlist');
      button.title = 'Remove from wishlist';
      toast('Added to wishlist');
    }
    write(WISHLIST_KEY, wishlist);
  }

  function productFromCard(card) {
    const name = card.querySelector('.prod-name')?.textContent.trim() || '';
    const cat = card.querySelector('.prod-cat')?.textContent.trim() || '';
    const price = Number(card.dataset.price || 0);
    const image = card.querySelector('.product-image')?.getAttribute('src') || '';
    return { id: card.dataset.productId || slug(name), name, category: cat, price, image };
  }

  function bindProductActions() {
    document.querySelectorAll('.prod-card').forEach(card => {
      const product = productFromCard(card);
      const add = card.querySelector('.add-cart-btn');
      const thumb = card.querySelector('.prod-thumb');

      // Keep exactly one wishlist button inside the product image,
      // aligned to the top-right of the media area.
      const wish = card.querySelector('.prod-wish');
      if (wish) {
        const wished = getWishlist().some(item => item.id === product.id);
        wish.classList.toggle('is-wishlisted', wished);
        wish.innerHTML = HEART_ICON;
        wish.classList.remove('inline-wish');
        if (thumb && wish.parentElement !== thumb) {
          thumb.appendChild(wish);
        }
        if (!wish.dataset.bound) {
          wish.dataset.bound = '1';
          wish.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation(); toggleWishlist(product, wish); updateWishlistBadges();
          });
        }
      }

      if (add && !add.dataset.bound) {
        add.dataset.bound = '1';
        add.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          addToCart(product);
          add.innerHTML = '✓'; add.classList.add('added');
          setTimeout(() => { add.innerHTML = CART_ICON; add.classList.remove('added'); }, 900);
        });
      }

      // Every product gets a visible Buy Now action below its price/actions.
      let buy = card.querySelector('.buy-now-btn');
      if (!buy) {
        buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'buy-now-btn';
        buy.textContent = 'Buy Now';
        card.querySelector('.prod-body')?.appendChild(buy);
      }
      if (!buy.dataset.bound) {
        buy.dataset.bound = '1';
        buy.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          addToCart(product);
          if (!isLoggedIn()) {
            requireLogin('checkout.html');
            return;
          }
          const loader = document.querySelector('.page-loader');
          if (loader) loader.classList.add('show');
          setTimeout(() => { window.location.href = 'checkout.html'; }, 180);
        });
      }

      const image = card.querySelector('.product-image');
      if (image && !image.dataset.modalBound) {
        image.dataset.modalBound = '1';
        image.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openImageModal(product.image, product.name); });
      }
    });
  }

  function getZoomImageSrc(src) {
    if (!src) return src;
    // Use the sharpened 2x master only in the lightbox so the card thumbnails stay lightweight.
    if (src.includes('assets/products/') && !src.includes('assets/products/zoom/')) {
      const candidate = src.replace('assets/products/', 'assets/products/zoom/');
      return candidate;
    }
    return src;
  }

  function openImageModal(src, title) {
    let modal = document.querySelector('.image-modal');
    if (!modal) {
      modal = document.createElement('div'); modal.className='image-modal';
      modal.innerHTML='<div class="image-modal-content"><button class="image-modal-close" aria-label="Close">×</button><img alt="" decoding="sync"><div class="image-modal-title"></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if(e.target===modal || e.target.closest('.image-modal-close')) modal.classList.remove('show'); });
    }
    const image = modal.querySelector('img');
    image.src = getZoomImageSrc(src);
    image.alt = title;
    image.loading = 'eager';
    image.decoding = 'sync';
    modal.querySelector('.image-modal-title').textContent=title;
    modal.classList.add('show');
  }

  function wishlistCount() { return getWishlist().length; }

  function updateWishlistBadges() {
    document.querySelectorAll('.wishlist-badge').forEach(b => b.textContent = wishlistCount());
  }

  function ensureNavbarFeatures() {
    document.querySelectorAll('.nav-tools').forEach(tools => {
      // Search button
      let search = tools.querySelector('[data-global-search]');
      if (!search) {
        search = tools.querySelector('.nav-icon-btn[aria-label="Search"]');
        if (search) search.dataset.globalSearch = '1';
      }
      if (!search) {
        search = document.createElement('button');
        search.type = 'button'; search.className = 'nav-icon-btn';
        search.setAttribute('aria-label','Search'); search.dataset.globalSearch='1';
        search.innerHTML = '<svg class="icon-svg" height="18" viewBox="0 0 24 24" width="18"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"></path><path d="m21 21-4.35-4.35"></path></svg>';
        tools.insertBefore(search, tools.firstElementChild);
      }

      // Wishlist button in every navbar.
      if (!tools.querySelector('[data-wishlist-nav]')) {
        const wish = document.createElement('a');
        wish.href='wishlist.html'; wish.className='nav-icon-btn wishlist-nav-link';
        wish.setAttribute('aria-label','Wishlist'); wish.dataset.wishlistNav='1';
        wish.innerHTML = HEART_ICON + '<span class="wishlist-badge">0</span>';
        tools.insertBefore(wish, tools.querySelector('.cart-nav-link') || tools.lastElementChild);
      }
    });
    updateWishlistBadges();
  }

  function setupGlobalSearch() {
    const buttons = document.querySelectorAll('[data-global-search]');
    if (!buttons.length) return;
    let overlay = document.querySelector('.search-overlay');
    if (!overlay) {
      overlay = document.createElement('div'); overlay.className='search-overlay';
      overlay.innerHTML = '<div class="search-dialog"><button type="button" class="search-close" aria-label="Close">×</button><p class="eyebrow">Search Chalk &amp; Cover</p><h2>Find school essentials</h2><form class="global-search-form"><input id="globalSearchInput" type="search" placeholder="Search textbooks, notebooks, pens..." autocomplete="off"><button class="btn-brand" type="submit">Search</button></form><div class="search-hint">Try “NCERT”, “notebook”, “geometry”, “pen” or “backpack”.</div></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', e => { if (e.target===overlay || e.target.closest('.search-close')) overlay.classList.remove('show'); });
      overlay.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const q=overlay.querySelector('#globalSearchInput').value.trim();
        if(!q) return;
        const url='products.html?search='+encodeURIComponent(q);
        overlay.classList.remove('show');
        const loader=document.querySelector('.page-loader'); if(loader) loader.classList.add('show');
        setTimeout(()=>window.location.href=url,180);
      });
    }
    buttons.forEach(btn=>{
      if(btn.dataset.searchBound) return; btn.dataset.searchBound='1';
      btn.addEventListener('click',e=>{e.preventDefault();overlay.classList.add('show'); setTimeout(()=>overlay.querySelector('input')?.focus(),60);});
    });
  }

  function setupWishlistPage() {
    const container=document.getElementById('wishlistItems'); if(!container) return;
    function render(){
      const items=getWishlist();
      if(!items.length){container.innerHTML='<div class="wishlist-empty"><div class="wishlist-empty-icon">♡</div><h2>Your wishlist is empty</h2><p>Save products you love and they will appear here.</p><a class="btn-brand" href="products.html">Browse Products</a></div>'; return;}
      container.innerHTML='<div class="wishlist-grid">'+items.map(i=>`<article class="wishlist-card"><div class="wishlist-card-image"><img src="${i.image}" alt="${i.name}"></div><div class="prod-cat">${i.category}</div><h3>${i.name}</h3><strong class="prod-price">${money(i.price)}</strong><div class="wishlist-card-actions"><button class="buy-now-btn" data-wish-buy="${i.id}" type="button">Buy Now</button><button class="wishlist-remove" data-wish-remove="${i.id}" type="button">Remove</button></div></article>`).join('')+'</div>';
      container.querySelectorAll('[data-wish-remove]').forEach(btn=>btn.addEventListener('click',()=>{let w=getWishlist().filter(i=>i.id!==btn.dataset.wishRemove);write(WISHLIST_KEY,w);updateWishlistBadges();render();toast('Removed from wishlist');}));
      container.querySelectorAll('[data-wish-buy]').forEach(btn=>btn.addEventListener('click',()=>{const item=getWishlist().find(i=>i.id===btn.dataset.wishBuy);if(item){addToCart(item);if(!isLoggedIn()){requireLogin('checkout.html');return;}window.location.href='checkout.html';}}));
      container.querySelectorAll('.wishlist-card-image img').forEach(img=>img.addEventListener('click',()=>openImageModal(img.src,img.alt)));
    }
    render();
  }

  function setupCheckoutPage(){
    const form=document.getElementById('checkoutForm'); if(!form) return;
    if (!isLoggedIn()) { requireLogin('checkout.html'); return; }
    const cart=getCart(); const box=document.getElementById('checkoutItems');
    if(!cart.length){ box.innerHTML='<p>Your cart is empty. <a href="products.html" style="color:var(--green-700);font-weight:700">Browse products</a></p>'; form.querySelector('button[type="submit"]').disabled=true; return; }
    box.className='checkout-items'; box.innerHTML=cart.map(i=>`<div class="checkout-item"><img src="${i.image}" alt="${i.name}"><span>${i.name} × ${i.qty}</span><strong>${money(i.price*i.qty)}</strong></div>`).join('');
    const subtotal=cart.reduce((s,i)=>s+i.price*i.qty,0), delivery=subtotal>=1000?0:49;
    document.getElementById('checkoutSubtotal').textContent=money(subtotal); document.getElementById('checkoutDelivery').textContent=delivery?money(delivery):'FREE'; document.getElementById('checkoutTotal').textContent=money(subtotal+delivery);
    const cardFields=document.getElementById('cardFields');
    document.querySelectorAll('input[name="payment"]').forEach(r=>r.addEventListener('change',()=>cardFields.style.display=r.value==='Card'&&r.checked?'block':'none'));
    cardFields.style.display='none';
    form.addEventListener('submit',e=>{e.preventDefault(); if(!form.checkValidity()){form.reportValidity();return;} const id='CC-'+Math.random().toString(36).slice(2,8).toUpperCase(); document.getElementById('orderNumber').textContent='Order ID: '+id; document.getElementById('successModal').classList.add('show'); localStorage.setItem(CART_KEY,'[]'); updateCartBadges(); });
    document.getElementById('successDone')?.addEventListener('click',()=>window.location.href='products.html');
  }

  function applyProductFilters() {
    const panels = document.querySelectorAll('[data-level-panel]');
    if (!panels.length) return;

    const activePanel = [...panels].find(panel => panel.style.display !== 'none') || panels[0];
    const selectedCategory = document.querySelector('.filter-box input[type="radio"][name="category"]:checked')?.dataset.category || 'all';
    const selectedCategories = selectedCategory === 'all' ? [] : [selectedCategory];
    const selectedPrice = document.querySelector('.filter-box input[type="radio"][name="price"]:checked');
    const min = selectedPrice ? Number(selectedPrice.dataset.min || 0) : 0;
    const max = selectedPrice && selectedPrice.dataset.max ? Number(selectedPrice.dataset.max) : Infinity;
    const searchTerm = (new URLSearchParams(window.location.search).get('search') || '').trim().toLowerCase();

    activePanel.querySelectorAll('.prod-card').forEach(card => {
      const categoryMatch = selectedCategories.length === 0 || selectedCategories.includes(card.dataset.category);
      const price = Number(card.dataset.price || 0);
      const priceMatch = price >= min && price <= max;
      const haystack = [card.querySelector('.prod-name')?.textContent, card.querySelector('.prod-cat')?.textContent].join(' ').toLowerCase();
      const searchMatch = !searchTerm || haystack.includes(searchTerm);
      card.style.display = categoryMatch && priceMatch && searchMatch ? '' : 'none';
    });

    let empty = activePanel.querySelector('.filter-empty');
    const visible = [...activePanel.querySelectorAll('.prod-card')].some(card => card.style.display !== 'none');
    if (!visible) {
      if (!empty) {
        empty = document.createElement('div');
        empty.className = 'filter-empty';
        empty.innerHTML = '<strong>No products found</strong><span>Try another category or price range.</span>';
        activePanel.appendChild(empty);
      }
      empty.style.display = 'flex';
    } else if (empty) {
      empty.style.display = 'none';
    }
  }

  function setupProductFilters() {
    const tabs = document.querySelectorAll('.level-tab');
    const panels = document.querySelectorAll('[data-level-panel]');
    if (!tabs.length || !panels.length) return;

    function showLevel(level, updateHash) {
      tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.level === level));
      panels.forEach(panel => panel.style.display = panel.dataset.levelPanel === level ? '' : 'none');
      if (updateHash) history.replaceState(null, '', '#' + level);
      applyProductFilters();
      const productArea = document.querySelector('.level-tabs');
      if (productArea && updateHash) productArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    tabs.forEach(tab => tab.addEventListener('click', () => showLevel(tab.dataset.level, true)));

    document.querySelectorAll('.filter-box input[type="radio"]').forEach(input => {
      input.addEventListener('change', applyProductFilters);
    });

    const hash = window.location.hash.replace('#', '');
    const params = new URLSearchParams(window.location.search);
    const initial = ['primary', 'middle', 'secondary'].includes(hash) ? hash : 'primary';
    showLevel(initial, false);
    const searchParam = params.get('search');
    const searchLabel = document.getElementById('searchResultLabel');
    if (searchLabel && searchParam) { searchLabel.style.display='block'; searchLabel.textContent='Search results for “'+searchParam+'”'; }
    const categoryParam = params.get('category');
    if (categoryParam) {
      const radio = document.querySelector(`.filter-box input[type="radio"][name="category"][data-category="${CSS.escape(categoryParam)}"]`);
      const all = document.querySelector('.filter-box input[type="radio"][name="category"][data-category="all"]');
      if (radio) radio.checked = true;
      else if (all) all.checked = true;
      applyProductFilters();
    }
  }

  function setupCartPage() {
    const container = document.getElementById('cartItems');
    if (!container) return;

    function render() {
      const cart = getCart();
      const summary = document.getElementById('cartSummary');
      const empty = document.getElementById('cartEmpty');
      if (!cart.length) {
        container.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        if (summary) summary.style.display = 'none';
        return;
      }
      if (empty) empty.style.display = 'none';
      container.innerHTML = cart.map(item => `
        <article class="cart-item">
          <div class="cart-item-image"><img src="${item.image}" alt="${item.name}"></div>
          <div class="cart-item-info"><div class="prod-cat">${item.category}</div><h3>${item.name}</h3><strong>${money(item.price)}</strong></div>
          <div class="qty-control"><button type="button" data-action="minus" data-id="${item.id}">−</button><span>${item.qty}</span><button type="button" data-action="plus" data-id="${item.id}">+</button></div>
          <strong class="cart-line-total">${money(item.price * item.qty)}</strong>
          <button class="cart-remove" type="button" data-action="remove" data-id="${item.id}" aria-label="Remove ${item.name}">Remove</button>
        </article>`).join('');

      const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
      const delivery = subtotal >= 1000 ? 0 : 49;
      const total = subtotal + delivery;
      document.getElementById('cartSubtotal').textContent = money(subtotal);
      document.getElementById('cartDelivery').textContent = delivery ? money(delivery) : 'FREE';
      document.getElementById('cartTotal').textContent = money(total);
      if (summary) summary.style.display = '';
    }

    container.addEventListener('click', e => {
      const button = e.target.closest('[data-action]');
      if (!button) return;
      const id = button.dataset.id;
      let cart = getCart();
      const item = cart.find(row => row.id === id);
      if (!item) return;
      if (button.dataset.action === 'plus') item.qty += 1;
      if (button.dataset.action === 'minus') item.qty -= 1;
      if (button.dataset.action === 'remove' || item.qty <= 0) cart = cart.filter(row => row.id !== id);
      write(CART_KEY, cart);
      updateCartBadges();
      render();
    });

    const clear = document.getElementById('clearCart');
    if (clear) clear.addEventListener('click', () => { write(CART_KEY, []); updateCartBadges(); render(); toast('Cart cleared'); });
    render();
  }

  function setupPageLoader() {
    let loader = document.querySelector('.page-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.className = 'page-loader';
      loader.innerHTML = '<div class="page-loader-spinner" aria-label="Loading"></div>';
      document.body.appendChild(loader);
    }
    const show = () => loader.classList.add('show');
    document.querySelectorAll('a[href]').forEach(link => {
      if (link.dataset.loaderBound) return;
      link.dataset.loaderBound = '1';
      link.addEventListener('click', e => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || link.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        // On mobile/tablet, the first tap on "Home" only opens the Home 1 / Home 2
        // submenu (see initHomeSubmenu below) and must not navigate yet. Let that
        // handler manage the tap; the loader takes over again on the second tap.
        if (link.classList.contains('nav-home-trigger') && window.innerWidth <= 1199) {
          const homeItem = link.closest('.nav-home-item');
          if (homeItem && !homeItem.classList.contains('is-open')) return;
        }
        try {
          const url = new URL(href, location.href);
          if (url.origin !== location.origin) return;
        } catch (_) { return; }
        e.preventDefault();
        show();
        setTimeout(() => { window.location.href = href; }, 280);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    var backdrop = document.querySelector('.nav-overlay-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'nav-overlay-backdrop';
      document.body.appendChild(backdrop);
    }

    if (toggle && links) {
      toggle.addEventListener('click', function () {
        if (links.classList.contains('open')) { closeMobileMenu(); } else { openMobileMenu(); }
      });
      backdrop.addEventListener('click', closeMobileMenu);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && links.classList.contains('open')) { closeMobileMenu(); }
      });
      // Close the overlay whenever a normal in-menu link is tapped, so it
      // doesn't stay open (and body scroll doesn't stay locked) once the
      // page starts navigating away, or once a same-page menu link scrolls
      // to a new position.
      links.querySelectorAll('a').forEach(function (a) {
        if (a.classList.contains('nav-home-trigger')) { return; } // handled separately below
        a.addEventListener('click', function () {
          if (window.innerWidth <= 1199) { closeMobileMenu(); }
        });
      });
    }
    // Recalculate the overlay's top offset if the viewport is resized
    // (e.g. rotating a tablet, or the navbar's own height changing) while
    // the menu is open — keeps it flush under the navbar, never reflowing
    // the page underneath.
    window.addEventListener('resize', function () {
      if (links && links.classList.contains('open')) { setMobileNavTop(); }
    });

    setupPageLoader();
    ensureNavbarFeatures();
    setupGlobalSearch();
    updateCartBadges();
    updateWishlistBadges();
    bindProductActions();
    setupProductFilters();
    setupCartPage();
    setupCheckoutPage();
    setupWishlistPage();

    document.querySelectorAll('form[data-brand-form]').forEach(form => {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const note = form.querySelector('.form-success');
        if (note) {
          note.style.display = 'flex';
          form.reset();
          note.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });

    const qtyInput = document.getElementById('bulkQty');
    const out = document.getElementById('bulkResult');
    if (qtyInput && out) {
      const calc = function () {
        const q = parseInt(qtyInput.value || '0', 10);
        let pct = 0, label = 'No discount tier yet — add more items';
        if (q >= 500) { pct = 20; label = 'School Tie-Up / 500+ tier'; }
        else if (q >= 200) { pct = 18; label = '200–499 units tier'; }
        else if (q >= 50) { pct = 12; label = '50–199 units tier'; }
        else if (q >= 10) { pct = 5; label = '10–49 units tier'; }
        out.querySelector('.calc-pct').textContent = pct + '%';
        out.querySelector('.calc-label').textContent = label;
      };
      qtyInput.addEventListener('input', calc); calc();
    }
  });
})();


// The mobile nav panel is a fixed-position overlay (see CSS) so opening it
// never reflows the page or pushes content down. This just tells it where
// the navbar's bottom edge currently is, via a CSS custom property, so the
// panel starts right below the navbar instead of overlapping it.
function setMobileNavTop() {
  var navbar = document.querySelector('.site-navbar');
  if (!navbar) { return; }
  var bottom = navbar.getBoundingClientRect().bottom;
  document.documentElement.style.setProperty('--mobile-nav-top', Math.max(0, bottom) + 'px');
}

// Locks background scrolling while the mobile menu is open, without losing
// or jumping the user's scroll position (the classic iOS Safari "body
// scroll lock" pattern: pin body in place at its current scroll offset,
// then restore that exact offset when closing).
var _scrollLockY = 0;
function lockBodyScroll() {
  _scrollLockY = window.scrollY || window.pageYOffset || 0;
  var prevBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  document.body.style.position = 'fixed';
  document.body.style.top = (-_scrollLockY) + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  // restore smooth-scroll behavior on the next frame, after the browser
  // has settled the (instant, unanimated) scroll offset change above
  requestAnimationFrame(function () {
    document.documentElement.style.scrollBehavior = prevBehavior;
  });
}
function unlockBodyScroll() {
  var prevBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, _scrollLockY);
  requestAnimationFrame(function () {
    document.documentElement.style.scrollBehavior = prevBehavior;
  });
}

function getMobileNavEls() {
  return {
    toggle: document.querySelector('.nav-toggle'),
    links: document.querySelector('.nav-links'),
    backdrop: document.querySelector('.nav-overlay-backdrop')
  };
}
function openMobileMenu() {
  var els = getMobileNavEls();
  if (!els.links) { return; }
  setMobileNavTop();
  els.links.classList.add('open');
  if (els.backdrop) { els.backdrop.classList.add('open'); }
  if (els.toggle) { els.toggle.setAttribute('aria-expanded', 'true'); }
  lockBodyScroll();
}
function closeMobileMenu() {
  var els = getMobileNavEls();
  if (!els.links || !els.links.classList.contains('open')) { return; }
  els.links.classList.remove('open');
  if (els.backdrop) { els.backdrop.classList.remove('open'); }
  if (els.toggle) { els.toggle.setAttribute('aria-expanded', 'false'); }
  unlockBodyScroll();
}

// ---------------------------------------------------------------
// Dark mode / Light mode toggle (persists across pages)
// ---------------------------------------------------------------
(function () {
  var THEME_KEY = 'chalkCoverTheme';

  function applyTheme(theme) {
    document.body.classList.toggle('dark-mode', theme === 'dark');
    document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
      var span = btn.querySelector('span');
      if (span) {
        span.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
      }
    });
  }

  var saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
    document.querySelectorAll('.theme-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      });
    });
  });
})();


// ---------------------------------------------------------------
// LTR / RTL direction toggle (persists across pages)
// ---------------------------------------------------------------
(function () {
  var DIR_KEY = 'chalkCoverDir';

  function applyDir(dir) {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', dir === 'rtl' ? 'ar' : 'en');
    document.querySelectorAll('.dir-toggle-btn').forEach(function (btn) {
      var label = btn.querySelector('.dir-toggle-label');
      if (label) label.textContent = dir === 'rtl' ? 'RTL' : 'LTR';
      btn.setAttribute('aria-pressed', dir === 'rtl' ? 'true' : 'false');
      btn.setAttribute('aria-label', dir === 'rtl' ? 'Switch to left-to-right layout' : 'Switch to right-to-left layout');
      btn.title = dir === 'rtl' ? 'Switch to LTR' : 'Switch to RTL';
    });
  }

  var saved = localStorage.getItem(DIR_KEY) || 'ltr';
  applyDir(saved);

  document.addEventListener('DOMContentLoaded', function () {
    applyDir(localStorage.getItem(DIR_KEY) || 'ltr');
    document.querySelectorAll('.dir-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('dir') === 'rtl' ? 'ltr' : 'rtl';
        localStorage.setItem(DIR_KEY, next);
        applyDir(next);
      });
    });
  });
})();


// ---------------------------------------------------------------
// Home 1: persona tab switcher ("Who are you shopping for today?")
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  var tabBtns = document.querySelectorAll('.h1-tab-btn');
  if (!tabBtns.length) return;
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = btn.getAttribute('data-h1-tab');
      document.querySelectorAll('.h1-tab-btn').forEach(function (b) { b.classList.toggle('active', b === btn); });
      document.querySelectorAll('.h1-tab-panel').forEach(function (p) {
        p.classList.toggle('active', p.getAttribute('data-h1-panel') === target);
      });
    });
  });
});


// ---------------------------------------------------------------
// Accordion fix: only one <details> panel open at a time, per group
// (used by Bulk Pricing FAQ, Home 2 FAQ, and any future accordions)
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.home2-faq, .accordion-group').forEach(function (group) {
    var items = group.querySelectorAll('details');
    items.forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (item.open) {
          items.forEach(function (other) {
            if (other !== item) other.open = false;
          });
        }
      });
    });
  });
});

// Final reference-style sticky navbar behavior.
(function(){
  function initReferenceNavbar(){
    var nav=document.querySelector('.site-navbar');
    if(!nav) return;
    var update=function(){ nav.classList.toggle('nav-scrolled', window.scrollY>8); };
    update();
    window.addEventListener('scroll',update,{passive:true});
    document.querySelectorAll('.nav-home-menu a').forEach(function(a){
      a.addEventListener('click',function(){
        var links=document.querySelector('.nav-links');
        if(links) links.classList.remove('open');
      });
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initReferenceNavbar); else initReferenceNavbar();
})();


// FINAL: Responsive Home submenu — desktop hover, mobile/tablet tap.
(function () {
  function initHomeSubmenu() {
    document.querySelectorAll('.nav-home-item').forEach(function (item) {
      var trigger = item.querySelector('.nav-home-trigger');
      var menu = item.querySelector('.nav-home-menu');
      if (!trigger || !menu || trigger.dataset.homeBound === '1') return;
      trigger.dataset.homeBound = '1';

      trigger.addEventListener('click', function (e) {
        var compact = window.innerWidth <= 1199;
        if (!compact) {
          // Desktop: click follows the Home link; hover/focus shows submenu.
          return;
        }
        // Mobile/tablet: first tap opens submenu; second tap goes to Home.
        if (!item.classList.contains('is-open')) {
          e.preventDefault();
          document.querySelectorAll('.nav-home-item.is-open').forEach(function (other) {
            if (other !== item) other.classList.remove('is-open');
          });
          item.classList.add('is-open');
        } else {
          item.classList.remove('is-open');
          // normal href navigation continues to index.html
        }
      });

      menu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          item.classList.remove('is-open');
          closeMobileMenu();
        });
      });
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest('.nav-home-item')) return;
      document.querySelectorAll('.nav-home-item.is-open').forEach(function (item) {
        item.classList.remove('is-open');
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHomeSubmenu);
  else initHomeSubmenu();
})();

// ---------------------------------------------------------------
// Back to Top button — injected on every page, no HTML edits needed.
// ---------------------------------------------------------------
(function initBackToTop() {
  function setup() {
    if (document.querySelector('.back-to-top-btn')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'back-to-top-btn';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg class="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path></svg>';
    document.body.appendChild(btn);

    btn.classList.add('is-visible');
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
