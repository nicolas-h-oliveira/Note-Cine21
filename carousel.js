/* Note Cine — Carrossel horizontal */
class HorizontalCarousel {
    constructor(wrapper) {
        this.wrapper = wrapper;
        this.viewport = wrapper.querySelector('.carousel-viewport');
        this.track = wrapper.querySelector('.carousel-track');
        this.btnLeft = wrapper.querySelector('.carousel-arrow--left');
        this.btnRight = wrapper.querySelector('.carousel-arrow--right');

        this.offset = 0;
        this.velocity = 0;
        this.isDragging = false;
        this.startX = 0;
        this.lastX = 0;
        this.lastTime = 0;
        this.rafId = null;
        this.maxOffset = 0;
        this.onLoadMore = null;
        this.isLoadingMore = false;

        this._bindEvents();
        this._updateBounds();
        this._updateArrows();
    }

    _bindEvents() {
        this.btnLeft?.addEventListener('click', () => this.scrollBy(this._scrollAmount()));
        this.btnRight?.addEventListener('click', () => this.scrollBy(-this._scrollAmount()));

        this.viewport.addEventListener('mousedown', (e) => this._onDragStart(e.clientX, e.clientY, e));
        window.addEventListener('mousemove', (e) => this._onDragMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', () => this._onDragEnd());

        this.viewport.addEventListener('touchstart', (e) => this._onDragStart(e.touches[0].clientX, e.touches[0].clientY, e), { passive: true });
        this.viewport.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                this._onDragMove(e.touches[0].clientX, e.touches[0].clientY);
                if (this.dragHorizontalPredominant) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
        this.viewport.addEventListener('touchend', () => this._onDragEnd());

        this.viewport.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                // If it is mainly vertical wheel scrolling, don't preventDefault or scroll horizontally
            } else {
                e.preventDefault();
                this.scrollBy(-e.deltaX * 0.8);
            }
        }, { passive: false });

        window.addEventListener('resize', debounce(() => this._updateBounds(), 150));

        const observer = new ResizeObserver(() => this._updateBounds());
        observer.observe(this.track);
    }

    _scrollAmount() {
        return this.viewport.clientWidth * 0.75;
    }

    _onDragStart(clientX, clientY, e) {
        if (e.target.closest('button')) return;
        this.isDragging = true;
        this.startX = clientX;
        this.startY = clientY;
        this.lastX = clientX;
        this.lastTime = performance.now();
        this.velocity = 0;
        this.dragHorizontalPredominant = false;
        this.dragChecked = false;
        this.track.classList.add('no-transition');
        this.viewport.classList.add('is-dragging');
        this._cancelMomentum();
    }

    _onDragMove(clientX, clientY) {
        if (!this.isDragging) return;

        if (!this.dragChecked) {
            const dx = Math.abs(clientX - this.startX);
            const dy = Math.abs(clientY - this.startY);
            if (dx + dy > 10) {
                this.dragChecked = true;
                if (dx > dy) {
                    this.dragHorizontalPredominant = true;
                } else {
                    this.isDragging = false;
                    this.viewport.classList.remove('is-dragging');
                    this.track.classList.remove('no-transition');
                    return;
                }
            } else {
                return;
            }
        }

        if (!this.dragHorizontalPredominant) return;

        const now = performance.now();
        const dt = now - this.lastTime;
        const dx = clientX - this.lastX;

        if (dt > 0) this.velocity = dx / dt;

        this.lastX = clientX;
        this.lastTime = now;
        this.offset += dx;
        this._clamp();
        this._applyTransform();
        this._checkLoadMore();
    }

    _onDragEnd() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.viewport.classList.remove('is-dragging');
        this.track.classList.remove('no-transition');
        this._startMomentum();
    }

    _startMomentum() {
        if (Math.abs(this.velocity) < 0.05) return;

        const friction = 0.92;
        const step = () => {
            this.velocity *= friction;
            if (Math.abs(this.velocity) < 0.01) {
                this.rafId = null;
                return;
            }
            this.offset += this.velocity * 16;
            this._clamp();
            this._applyTransform();
            this._checkLoadMore();
            this.rafId = requestAnimationFrame(step);
        };
        this.rafId = requestAnimationFrame(step);
    }

    _cancelMomentum() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    scrollBy(amount) {
        this._cancelMomentum();
        this.track.classList.remove('no-transition');
        this.offset += amount;
        this._clamp(true);
        this._applyTransform(true);
        this._checkLoadMore();
    }

    _clamp(animate = false) {
        this._updateBounds();
        if (this.offset > 0) this.offset = animate ? 0 : this.offset * 0.3;
        if (this.offset < -this.maxOffset) {
            this.offset = animate ? -this.maxOffset : this.offset + (-this.maxOffset - this.offset) * 0.3;
        }
    }

    _updateBounds() {
        const trackW = this.track.scrollWidth;
        const viewW = this.viewport.clientWidth;
        this.maxOffset = Math.max(0, trackW - viewW);
    }

    _applyTransform(animate = false) {
        if (animate) {
            this.track.style.transition = 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        } else {
            this.track.style.transition = '';
        }
        this.track.style.transform = `translate3d(${this.offset}px, 0, 0)`;
        this._updateArrows();
    }

    _updateArrows() {
        if (!this.btnLeft || !this.btnRight) return;
        const canScroll = this.maxOffset > 8;
        if (!canScroll) {
            this.btnLeft.classList.remove('is-visible');
            this.btnRight.classList.remove('is-visible');
            return;
        }
        this.btnLeft.classList.toggle('is-visible', this.offset < -8);
        this.btnRight.classList.toggle('is-visible', this.offset > -this.maxOffset + 8);
    }

    _checkLoadMore() {
        if (!this.onLoadMore || this.isLoadingMore) return;
        const threshold = this.maxOffset - 200;
        if (-this.offset >= threshold && this.maxOffset > 0) {
            this.isLoadingMore = true;
            Promise.resolve(this.onLoadMore()).finally(() => {
                this.isLoadingMore = false;
                this._updateBounds();
            });
        }
    }

    refresh() {
        this._updateBounds();
        this._updateArrows();
    }

    reset() {
        this.offset = 0;
        this._applyTransform(true);
    }
}

function initCarousels() {
    return [...document.querySelectorAll('.carousel-wrapper')].map(w => {
        if (w.__carouselInstance) return w.__carouselInstance;
        const instance = new HorizontalCarousel(w);
        w.__carouselInstance = instance;
        return instance;
    });
}
