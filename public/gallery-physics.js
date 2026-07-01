/* global Matter */
window.GalleryPhysics = (() => {
  let engine = null;
  let runner = null;
  let mouseConstraint = null;
  let resizeObserver = null;
  let rafId = null;
  let container = null;
  let pairs = [];
  let walls = [];
  let onTap = null;
  let dragStart = null;
  let wheelHandler = null;
  let scrollParent = null;

  function resetCardStyles() {
    pairs.forEach(({ el }) => {
      el.style.transform = '';
      el.style.width = '';
      el.style.margin = '';
    });
    if (container) container.style.minHeight = '';
  }

  function destroy() {
    resetCardStyles();
    if (container && wheelHandler) {
      container.removeEventListener('wheel', wheelHandler);
      wheelHandler = null;
    }
    scrollParent = null;
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (runner) {
      Matter.Runner.stop(runner);
      runner = null;
    }
    if (mouseConstraint && engine) {
      Matter.Composite.remove(engine.world, mouseConstraint);
      mouseConstraint = null;
    }
    if (engine) {
      Matter.Engine.clear(engine);
      engine = null;
    }
    pairs = [];
    walls = [];
    container = null;
    dragStart = null;
  }

  function getBounds() {
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(rect.width, 320),
      height: getContentHeight(),
    };
  }

  function getContentHeight() {
    let maxBottom = 520;
    pairs.forEach(({ body, halfH }) => {
      maxBottom = Math.max(maxBottom, body.position.y + halfH + 80);
    });
    const rectHeight = container ? container.getBoundingClientRect().height : 0;
    return Math.max(maxBottom, rectHeight, 520);
  }

  function buildWalls(width, height) {
    const { Bodies } = Matter;
    const thick = 80;
    return [
      Bodies.rectangle(width / 2, -thick / 2, width + thick * 2, thick, { isStatic: true }),
      Bodies.rectangle(width / 2, height + thick / 2, width + thick * 2, thick, { isStatic: true }),
      Bodies.rectangle(-thick / 2, height / 2, thick, height + thick * 2, { isStatic: true }),
      Bodies.rectangle(width + thick / 2, height / 2, thick, height + thick * 2, { isStatic: true }),
    ];
  }

  function refreshWalls() {
    if (!engine || !container) return;
    const width = Math.max(container.getBoundingClientRect().width, 320);
    const height = getContentHeight();
    walls.forEach(wall => Matter.Composite.remove(engine.world, wall));
    walls = buildWalls(width, height);
    Matter.Composite.add(engine.world, walls);
    container.style.minHeight = `${Math.ceil(height)}px`;
  }

  function syncCards() {
    let maxBottom = 0;
    pairs.forEach(({ body, el, halfW, halfH }) => {
      const x = Math.round(body.position.x - halfW);
      const y = Math.round(body.position.y - halfH);
      const angle = Math.abs(body.angularVelocity) < 0.002 ? 0 : body.angle;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}rad)`;
      maxBottom = Math.max(maxBottom, body.position.y + halfH);
    });
    if (container && maxBottom > 0) {
      container.style.minHeight = `${Math.ceil(maxBottom + 80)}px`;
    }
  }

  function bindWheelScroll() {
    scrollParent = container?.closest('.gallery-view');
    if (!container || !scrollParent || wheelHandler) return;

    wheelHandler = e => {
      const maxScroll = scrollParent.scrollHeight - scrollParent.clientHeight;
      if (maxScroll <= 0) return;

      const next = scrollParent.scrollTop + e.deltaY;
      const clamped = Math.max(0, Math.min(maxScroll, next));
      if (clamped === scrollParent.scrollTop) return;

      scrollParent.scrollTop = clamped;
      e.preventDefault();
    };

    container.addEventListener('wheel', wheelHandler, { passive: false });
  }

  function loop() {
    syncCards();
    rafId = requestAnimationFrame(loop);
  }

  function mount(root, tapHandler) {
    if (!window.Matter) return false;
    destroy();

    const cards = [...root.querySelectorAll('.product-card')];
    if (cards.length === 0) return false;

    container = root;
    onTap = tapHandler;

    const { Engine, Runner, Bodies, Body, Composite, Mouse, MouseConstraint, Events } = Matter;

    engine = Engine.create({
      gravity: { x: 0, y: 0.28 },
      positionIterations: 8,
      velocityIterations: 6,
      enableSleeping: true,
    });
    runner = Runner.create({ isFixed: true, delta: 1000 / 60 });
    Runner.run(runner, engine);

    const { width } = getBounds();
    const cardWidth = Math.min(220, Math.max(160, (width - 40) / 4));
    const gap = 10;
    let cursorX = gap + cardWidth / 2;
    let cursorY = gap + 120;
    let rowHeight = 0;

    cards.forEach((el, index) => {
      el.style.width = `${cardWidth}px`;
      el.style.margin = '0';
      const height = Math.max(el.offsetHeight, 220);
      const halfW = cardWidth / 2;
      const halfH = height / 2;

      if (cursorX + halfW > width - gap) {
        cursorX = gap + halfW;
        cursorY += rowHeight + gap;
        rowHeight = 0;
      }

      const jitterX = ((index * 37) % 16) - 8;
      const jitterY = ((index * 53) % 12) - 6;
      const x = cursorX + jitterX;
      const y = cursorY + jitterY;

      const body = Bodies.rectangle(x, y, cardWidth, height, {
        restitution: 0.52,
        friction: 0.12,
        frictionAir: 0.032,
        density: 0.0009,
        chamfer: { radius: 10 },
        plugin: { productId: Number(el.dataset.id) },
      });

      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.015);
      pairs.push({ body, el, halfW, halfH });
      Composite.add(engine.world, body);

      cursorY += 0;
      rowHeight = Math.max(rowHeight, height);
      cursorX += cardWidth + gap;
      if (cursorX + halfW > width - gap) {
        cursorX = gap + halfW;
        cursorY += rowHeight + gap;
        rowHeight = 0;
      }
    });

    refreshWalls();

    const mouse = Mouse.create(container);
    mouse.element.removeEventListener('mousewheel', mouse.mousewheel);
    mouse.element.removeEventListener('DOMMouseScroll', mouse.mousewheel);

    mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.22,
        damping: 0.28,
        render: { visible: false },
      },
    });
    Composite.add(engine.world, mouseConstraint);

    Events.on(mouseConstraint, 'startdrag', event => {
      dragStart = event.body
        ? { x: event.body.position.x, y: event.body.position.y, id: event.body.plugin.productId }
        : null;
      if (event.body) {
        Body.setAngularVelocity(event.body, 0);
      }
    });

    Events.on(mouseConstraint, 'enddrag', event => {
      const body = event.body;
      if (!body || !dragStart) {
        dragStart = null;
        return;
      }
      const dx = body.position.x - dragStart.x;
      const dy = body.position.y - dragStart.y;
      if (Math.hypot(dx, dy) < 10 && onTap) {
        onTap(dragStart.id);
      } else {
        Body.setAngularVelocity(body, body.angularVelocity * 0.35);
      }
      dragStart = null;
    });

    resizeObserver = new ResizeObserver(() => refreshWalls());
    resizeObserver.observe(container);
    bindWheelScroll();
    loop();
    return true;
  }

  return { mount, destroy, isActive: () => Boolean(engine) };
})();