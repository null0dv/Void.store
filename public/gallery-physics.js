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

  function destroy() {
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
      height: Math.max(rect.height, 480),
    };
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
    const { width, height } = getBounds();
    walls.forEach(wall => Matter.Composite.remove(engine.world, wall));
    walls = buildWalls(width, height);
    Matter.Composite.add(engine.world, walls);
    container.style.minHeight = `${Math.max(height, 520)}px`;
  }

  function syncCards() {
    pairs.forEach(({ body, el, halfW, halfH }) => {
      const x = body.position.x - halfW;
      const y = body.position.y - halfH;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${body.angle}rad)`;
    });
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
      gravity: { x: 0, y: 0.45 },
    });
    runner = Runner.create();
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

      const jitterX = ((index * 37) % 24) - 12;
      const jitterY = ((index * 53) % 20) - 10;
      const x = cursorX + jitterX;
      const y = cursorY + jitterY;

      const body = Bodies.rectangle(x, y, cardWidth, height, {
        restitution: 0.72,
        friction: 0.08,
        frictionAir: 0.018,
        density: 0.0012,
        chamfer: { radius: 10 },
        plugin: { productId: Number(el.dataset.id) },
      });

      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
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
        stiffness: 0.14,
        damping: 0.12,
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
      }
      dragStart = null;
    });

    resizeObserver = new ResizeObserver(() => refreshWalls());
    resizeObserver.observe(container);
    loop();
    return true;
  }

  return { mount, destroy, isActive: () => Boolean(engine) };
})();