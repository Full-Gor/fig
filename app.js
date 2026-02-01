/**
 * DesigneMe - Main Application
 * A web-based design tool
 */

// ========================================
// GLOBAL STATE
// ========================================

const state = {
    // Canvas
    canvas: null,
    ctx: null,
    canvasWrapper: null,

    // Zoom & Pan
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    lastPanPoint: { x: 0, y: 0 },

    // Tools
    currentTool: 'select',
    isDrawing: false,
    startPoint: { x: 0, y: 0 },
    currentPoint: { x: 0, y: 0 },

    // Objects
    objects: [],
    selectedObjects: [],
    clipboard: [],
    history: [],
    historyIndex: -1,

    // Object being drawn
    tempObject: null,

    // Drag
    isDragging: false,
    dragOffset: { x: 0, y: 0 },

    // Resize
    isResizing: false,
    resizeHandle: null,
    resizeStartBounds: null,

    // Selection box
    isSelecting: false,
    selectionStart: { x: 0, y: 0 },

    // Text editing
    isEditingText: false,
    editingTextObject: null,

    // Pen tool
    penPath: null,

    // Presentation mode
    isPresenting: false,

    // Default styles
    defaultFill: '#5E5CE6',
    defaultStroke: '#FFFFFF',
    defaultStrokeWidth: 0,
    defaultOpacity: 100,
    defaultCornerRadius: 0,

    // Layer counter
    layerCounter: 0
};

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    initEventListeners();
    initToolbar();
    initPanels();
    initKeyboardShortcuts();
    resizeCanvas();
    render();

    showToast('Bienvenue dans DesigneMe!', 'success');
});

function initCanvas() {
    state.canvas = document.getElementById('main-canvas');
    state.ctx = state.canvas.getContext('2d');
    state.canvasWrapper = document.getElementById('canvas-wrapper');

    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    const wrapper = state.canvasWrapper;
    state.canvas.width = wrapper.clientWidth;
    state.canvas.height = wrapper.clientHeight;
    render();
}

// ========================================
// EVENT LISTENERS
// ========================================

function initEventListeners() {
    const canvas = state.canvas;

    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('dblclick', handleDoubleClick);

    // Touch events for mobile/tablet
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    // Context menu
    canvas.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', hideContextMenu);

    // Prevent default drag
    canvas.addEventListener('dragstart', (e) => e.preventDefault());

    // Initialize mobile panel toggles
    initMobilePanels();
}

// ========================================
// TOUCH EVENT HANDLERS
// ========================================

let touchState = {
    lastTouchTime: 0,
    lastTouchPoint: null,
    isPinching: false,
    initialPinchDistance: 0,
    initialZoom: 1
};

function handleTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
        // Pinch zoom start
        touchState.isPinching = true;
        touchState.initialPinchDistance = getTouchDistance(e.touches);
        touchState.initialZoom = state.zoom;
        return;
    }

    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();

        // Check for double tap
        if (now - touchState.lastTouchTime < 300 && touchState.lastTouchPoint) {
            const dx = touch.clientX - touchState.lastTouchPoint.x;
            const dy = touch.clientY - touchState.lastTouchPoint.y;
            if (Math.sqrt(dx * dx + dy * dy) < 30) {
                // Double tap detected
                handleDoubleTap(touch);
                touchState.lastTouchTime = 0;
                return;
            }
        }

        touchState.lastTouchTime = now;
        touchState.lastTouchPoint = { x: touch.clientX, y: touch.clientY };

        // Simulate mouse down
        const mouseEvent = createMouseEventFromTouch(touch, 'mousedown');
        handleMouseDown(mouseEvent);
    }
}

function handleTouchMove(e) {
    e.preventDefault();

    if (touchState.isPinching && e.touches.length === 2) {
        // Pinch zoom
        const currentDistance = getTouchDistance(e.touches);
        const scale = currentDistance / touchState.initialPinchDistance;
        const newZoom = Math.min(Math.max(touchState.initialZoom * scale, 0.1), 10);

        // Get center point of pinch
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = state.canvas.getBoundingClientRect();
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;

        // Adjust pan to zoom towards pinch center
        const zoomRatio = newZoom / state.zoom;
        state.panX = mouseX - (mouseX - state.panX) * zoomRatio;
        state.panY = mouseY - (mouseY - state.panY) * zoomRatio;

        state.zoom = newZoom;
        document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
        render();
        return;
    }

    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const mouseEvent = createMouseEventFromTouch(touch, 'mousemove');
        handleMouseMove(mouseEvent);
    }
}

function handleTouchEnd(e) {
    e.preventDefault();

    if (touchState.isPinching) {
        touchState.isPinching = false;
        if (e.touches.length === 0) {
            return;
        }
    }

    if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const mouseEvent = createMouseEventFromTouch(touch, 'mouseup');
        handleMouseUp(mouseEvent);
    }
}

function handleDoubleTap(touch) {
    const point = getCanvasPointFromTouch(touch);

    if (state.currentTool === 'select') {
        const obj = getObjectAtPoint(point);
        if (obj && obj.type === 'text') {
            startTextEditing(obj);
        }
    }
}

function createMouseEventFromTouch(touch, type) {
    return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        shiftKey: false,
        preventDefault: () => {},
        stopPropagation: () => {}
    };
}

function getCanvasPointFromTouch(touch) {
    const rect = state.canvas.getBoundingClientRect();
    const x = (touch.clientX - rect.left - state.panX) / state.zoom;
    const y = (touch.clientY - rect.top - state.panY) / state.zoom;
    return { x, y };
}

function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// ========================================
// MOBILE PANELS
// ========================================

function initMobilePanels() {
    // Create mobile panel toggle buttons if they don't exist
    if (!document.querySelector('.mobile-panel-toggle.left')) {
        const leftToggle = document.createElement('button');
        leftToggle.className = 'mobile-panel-toggle left';
        leftToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
        leftToggle.addEventListener('click', () => toggleMobilePanel('left'));
        document.body.appendChild(leftToggle);
    }

    if (!document.querySelector('.mobile-panel-toggle.right')) {
        const rightToggle = document.createElement('button');
        rightToggle.className = 'mobile-panel-toggle right';
        rightToggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>';
        rightToggle.addEventListener('click', () => toggleMobilePanel('right'));
        document.body.appendChild(rightToggle);
    }

    // Create overlay
    if (!document.querySelector('.mobile-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        overlay.addEventListener('click', closeMobilePanels);
        document.body.appendChild(overlay);
    }
}

function toggleMobilePanel(side) {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    const overlay = document.querySelector('.mobile-overlay');

    if (side === 'left') {
        const isOpen = leftPanel.classList.contains('open');
        leftPanel.classList.toggle('open');
        rightPanel.classList.remove('open');
        overlay.classList.toggle('visible', !isOpen);
    } else {
        const isOpen = rightPanel.classList.contains('open');
        rightPanel.classList.toggle('open');
        leftPanel.classList.remove('open');
        overlay.classList.toggle('visible', !isOpen);
    }
}

function closeMobilePanels() {
    document.querySelector('.left-panel')?.classList.remove('open');
    document.querySelector('.right-panel')?.classList.remove('open');
    document.querySelector('.mobile-overlay')?.classList.remove('visible');
}

function handleMouseDown(e) {
    const point = getCanvasPoint(e);

    // Middle mouse button or Space + Left click for panning
    if (e.button === 1 || (e.button === 0 && e.spaceKey)) {
        state.isPanning = true;
        state.lastPanPoint = { x: e.clientX, y: e.clientY };
        state.canvas.style.cursor = 'grabbing';
        return;
    }

    // Left click
    if (e.button === 0) {
        switch (state.currentTool) {
            case 'select':
                handleSelectToolDown(point, e);
                break;
            case 'move':
                state.isPanning = true;
                state.lastPanPoint = { x: e.clientX, y: e.clientY };
                state.canvas.style.cursor = 'grabbing';
                break;
            case 'rectangle':
            case 'ellipse':
            case 'line':
            case 'polygon':
            case 'star':
            case 'frame':
                handleShapeToolDown(point);
                break;
            case 'text':
                handleTextToolDown(point);
                break;
            case 'pencil':
                handlePencilToolDown(point);
                break;
            case 'pen':
                handlePenToolDown(point);
                break;
            case 'eraser':
                handleEraserToolDown(point);
                break;
            case 'image':
                handleImageToolDown(point);
                break;
            case 'comment':
                handleCommentToolDown(point);
                break;
            default:
                // Default to select behavior
                handleSelectToolDown(point, e);
                break;
        }
    }
}

function handleMouseMove(e) {
    const point = getCanvasPoint(e);
    state.currentPoint = point;

    // Panning
    if (state.isPanning) {
        const dx = e.clientX - state.lastPanPoint.x;
        const dy = e.clientY - state.lastPanPoint.y;
        state.panX += dx;
        state.panY += dy;
        state.lastPanPoint = { x: e.clientX, y: e.clientY };
        render();
        return;
    }

    // Drawing shapes or pencil
    if (state.isDrawing && state.tempObject) {
        if (state.tempObject.type === 'path') {
            // Pencil drawing - add points
            state.tempObject.points.push(point);
        } else if (state.tempObject.type === 'eraser') {
            // Eraser tool - handled separately
            handleEraserToolMove(point);
            return;
        } else {
            // Shape drawing - update dimensions
            updateTempObject(point);
        }
        render();
        return;
    }

    // Dragging objects
    if (state.isDragging && state.selectedObjects.length > 0) {
        const dx = point.x - state.dragOffset.x;
        const dy = point.y - state.dragOffset.y;

        state.selectedObjects.forEach(obj => {
            obj.x = obj.dragStartX + dx;
            obj.y = obj.dragStartY + dy;
        });

        updatePropertiesPanel();
        render();
        return;
    }

    // Resizing
    if (state.isResizing && state.selectedObjects.length === 1) {
        handleResize(point);
        render();
        return;
    }

    // Selection box
    if (state.isSelecting) {
        renderSelectionBox(point);
        return;
    }

    // Update cursor based on hover
    updateCursor(point);
}

function handleMouseUp(e) {
    const point = getCanvasPoint(e);

    if (state.isPanning) {
        state.isPanning = false;
        state.canvas.style.cursor = getCursorForTool(state.currentTool);
    }

    if (state.isDrawing && state.tempObject) {
        if (state.tempObject.type === 'eraser') {
            handleEraserToolUp();
        } else {
            finalizeObject();
        }
    }

    if (state.isDragging) {
        state.isDragging = false;
        state.selectedObjects.forEach(obj => {
            delete obj.dragStartX;
            delete obj.dragStartY;
        });
        saveHistory();
    }

    if (state.isResizing) {
        state.isResizing = false;
        state.resizeHandle = null;
        saveHistory();
    }

    if (state.isSelecting) {
        finalizeSelection(point);
    }

    render();
}

function handleWheel(e) {
    e.preventDefault();

    const rect = state.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(state.zoom * delta, 0.1), 10);

    // Adjust pan to zoom towards mouse position
    const zoomRatio = newZoom / state.zoom;
    state.panX = mouseX - (mouseX - state.panX) * zoomRatio;
    state.panY = mouseY - (mouseY - state.panY) * zoomRatio;

    state.zoom = newZoom;

    // Update zoom display
    document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';

    render();
}

function handleDoubleClick(e) {
    const point = getCanvasPoint(e);

    if (state.currentTool === 'select') {
        const obj = getObjectAtPoint(point);
        if (obj && obj.type === 'text') {
            startTextEditing(obj);
        }
    }
}

function handleContextMenu(e) {
    e.preventDefault();
    const menu = document.getElementById('context-menu');
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.remove('hidden');
}

function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
}

// ========================================
// TOOL HANDLERS
// ========================================

function handleSelectToolDown(point, e) {
    // Check if clicking on resize handle
    const handle = getResizeHandleAtPoint(point);
    if (handle && state.selectedObjects.length === 1) {
        state.isResizing = true;
        state.resizeHandle = handle;
        state.resizeStartBounds = { ...state.selectedObjects[0] };
        state.startPoint = point;
        return;
    }

    // Check if clicking on an object
    const obj = getObjectAtPoint(point);

    if (obj) {
        if (e.shiftKey) {
            // Toggle selection
            const index = state.selectedObjects.indexOf(obj);
            if (index > -1) {
                state.selectedObjects.splice(index, 1);
            } else {
                state.selectedObjects.push(obj);
            }
        } else {
            // Select single object (if not already selected)
            if (!state.selectedObjects.includes(obj)) {
                state.selectedObjects = [obj];
            }
        }

        // Start dragging
        state.isDragging = true;
        state.dragOffset = point;
        state.selectedObjects.forEach(obj => {
            obj.dragStartX = obj.x;
            obj.dragStartY = obj.y;
        });
    } else {
        // Start selection box
        if (!e.shiftKey) {
            state.selectedObjects = [];
        }
        state.isSelecting = true;
        state.selectionStart = point;
    }

    updatePropertiesPanel();
    updateLayersPanel();
    render();
}

function handleShapeToolDown(point) {
    // Draw on top of existing elements - don't select them
    state.isDrawing = true;
    state.startPoint = point;

    const type = state.currentTool;

    state.tempObject = {
        id: generateId(),
        type: type,
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        fill: type === 'frame' ? '#ffffff' : state.defaultFill,
        stroke: type === 'frame' ? '#cccccc' : state.defaultStroke,
        strokeWidth: type === 'frame' ? 1 : state.defaultStrokeWidth,
        opacity: state.defaultOpacity,
        rotation: 0,
        cornerRadius: state.defaultCornerRadius,
        name: getObjectName(type)
    };

    if (type === 'line') {
        state.tempObject.x2 = point.x;
        state.tempObject.y2 = point.y;
    }

    if (type === 'polygon') {
        state.tempObject.sides = 3;
    }

    if (type === 'star') {
        state.tempObject.points = 5;
        state.tempObject.innerRadius = 0.5;
    }
}

function handleTextToolDown(point) {
    // If currently editing text, finish that first and switch to select
    if (state.isEditingText) {
        const existingTextarea = document.querySelector('.text-input-overlay');
        if (existingTextarea) {
            finishTextEditing(existingTextarea);
        }
        selectTool('select');
        return;
    }

    // Create text at click point
    const textObj = {
        id: generateId(),
        type: 'text',
        x: point.x,
        y: point.y,
        width: 200,
        height: 50,
        text: 'Texte',
        fontSize: 32,
        fontFamily: 'Inter',
        fill: state.defaultFill,
        opacity: state.defaultOpacity,
        rotation: 0,
        name: getObjectName('text')
    };

    state.objects.push(textObj);
    state.selectedObjects = [textObj];
    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();
    render();

    // Start editing immediately, then switch to select tool when done
    startTextEditing(textObj);
}

function handlePencilToolDown(point) {
    // Draw on top of existing elements - don't select them
    state.isDrawing = true;
    // Use fill color for stroke (visible on dark bg), fallback to bright green
    const strokeColor = (state.defaultFill && state.defaultFill !== 'transparent') ? state.defaultFill : '#00FF00';
    state.tempObject = {
        id: generateId(),
        type: 'path',
        x: point.x,
        y: point.y,
        width: 0,
        height: 0,
        points: [{ x: point.x, y: point.y }],
        stroke: strokeColor,
        strokeWidth: 4,
        fill: 'transparent',
        opacity: 100,
        rotation: 0,
        name: getObjectName('path')
    };
}

// Pen tool - for creating vector paths
function handlePenToolDown(point) {
    // If we're already drawing a pen path, add a point
    if (state.penPath && state.penPath.points.length > 0) {
        // Check for closing: if clicking near first point, close the path
        const first = state.penPath.points[0];
        const dist = Math.sqrt((point.x - first.x) ** 2 + (point.y - first.y) ** 2);
        if (dist < 15 && state.penPath.points.length > 2) {
            state.penPath.closed = true;
            finalizePenPath();
            return;
        }
        state.penPath.points.push({ x: point.x, y: point.y, type: 'corner' });
        render();
        drawPenPreview();
    } else {
        // Start a new pen path
        const strokeColor = (state.defaultFill && state.defaultFill !== 'transparent') ? state.defaultFill : '#00FF00';
        state.penPath = {
            id: generateId(),
            type: 'vector',
            x: point.x,
            y: point.y,
            width: 0,
            height: 0,
            points: [{ x: point.x, y: point.y, type: 'corner' }],
            stroke: strokeColor,
            strokeWidth: 3,
            fill: 'transparent',
            opacity: 100,
            rotation: 0,
            closed: false,
            name: getObjectName('vector')
        };
        render();
        drawPenPreview();
    }
}

function finalizePenPath() {
    if (!state.penPath || !state.penPath.points || state.penPath.points.length < 1) {
        state.penPath = null;
        render();
        return;
    }

    // Calculate bounding box from points
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.penPath.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });

    state.penPath.x = minX;
    state.penPath.y = minY;
    state.penPath.width = Math.max(maxX - minX, 10);
    state.penPath.height = Math.max(maxY - minY, 10);

    // Add to objects array
    state.objects.push(state.penPath);
    state.selectedObjects = [state.penPath];
    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();

    showToast('Tracé vectoriel ajouté');

    state.penPath = null;
    render();
}

function drawPenPreview() {
    if (!state.penPath || state.penPath.points.length === 0) return;

    const ctx = state.ctx;
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);

    ctx.strokeStyle = state.penPath.stroke;
    ctx.lineWidth = state.penPath.strokeWidth;
    ctx.beginPath();

    const points = state.penPath.points;
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }

    // Draw to current mouse position
    if (state.currentPoint) {
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
    }

    ctx.stroke();

    // Draw points
    points.forEach((p, i) => {
        ctx.fillStyle = i === 0 ? '#00ff00' : '#ffffff';
        ctx.strokeStyle = '#5e5ce6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });

    ctx.restore();
}

// ========================================
// ERASER TOOL
// ========================================

function handleEraserToolDown(point) {
    state.isDrawing = true;
    state.tempObject = {
        type: 'eraser',
        points: [{ x: point.x, y: point.y }],
        size: 20 // Default eraser size
    };
}

function handleEraserToolMove(point) {
    if (!state.isDrawing || !state.tempObject || state.tempObject.type !== 'eraser') return;

    state.tempObject.points.push(point);

    // Erase objects that intersect with the eraser path
    const eraserSize = state.tempObject.size;
    const lastPoint = point;

    // Find and remove objects under the eraser
    const objectsToRemove = [];

    state.objects.forEach(obj => {
        const bounds = getObjectBounds(obj);

        // Check if the eraser point is within the object bounds (with padding for eraser size)
        if (lastPoint.x >= bounds.x - eraserSize &&
            lastPoint.x <= bounds.x + bounds.width + eraserSize &&
            lastPoint.y >= bounds.y - eraserSize &&
            lastPoint.y <= bounds.y + bounds.height + eraserSize) {
            objectsToRemove.push(obj);
        }
    });

    // Remove objects that were touched by the eraser
    objectsToRemove.forEach(obj => {
        const index = state.objects.indexOf(obj);
        if (index > -1) {
            state.objects.splice(index, 1);
            // Also remove from selection if selected
            const selIndex = state.selectedObjects.indexOf(obj);
            if (selIndex > -1) {
                state.selectedObjects.splice(selIndex, 1);
            }
        }
    });

    if (objectsToRemove.length > 0) {
        render();
        drawEraserPreview();
    } else {
        render();
        drawEraserPreview();
    }
}

function handleEraserToolUp() {
    if (!state.isDrawing || !state.tempObject || state.tempObject.type !== 'eraser') return;

    state.isDrawing = false;
    state.tempObject = null;

    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();
    render();
}

function drawEraserPreview() {
    if (!state.tempObject || state.tempObject.type !== 'eraser') return;

    const ctx = state.ctx;
    const points = state.tempObject.points;
    if (points.length === 0) return;

    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);

    // Draw eraser cursor at last point
    const lastPoint = points[points.length - 1];
    const size = state.tempObject.size;

    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2 / state.zoom;
    ctx.setLineDash([5 / state.zoom, 5 / state.zoom]);
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, size / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw eraser path
    if (points.length > 1) {
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.5)';
        ctx.lineWidth = size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        ctx.stroke();
    }

    ctx.restore();
}

// Image tool - import images via persistent hidden input
(function initImageInput() {
    // Create a persistent hidden file input at page load
    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'image-file-input';
    input.accept = 'image/*';
    input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';

    input.addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;

        const pt = state._imageInsertPoint || { x: 100, y: 100 };
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                let w = img.width;
                let h = img.height;

                // Scale down if too large
                const maxSize = 500;
                if (w > maxSize || h > maxSize) {
                    const s = Math.min(maxSize / w, maxSize / h);
                    w = Math.round(w * s);
                    h = Math.round(h * s);
                }

                const imageObj = {
                    id: generateId(),
                    type: 'image',
                    x: pt.x,
                    y: pt.y,
                    width: w,
                    height: h,
                    src: event.target.result,
                    opacity: 100,
                    rotation: 0,
                    name: getObjectName('image')
                };

                state.objects.push(imageObj);
                state.selectedObjects = [imageObj];
                saveHistory();
                updateLayersPanel();
                updatePropertiesPanel();
                render();
                selectTool('select');
                showToast('Image ajoutée');
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);

        // Reset input so same file can be selected again
        this.value = '';
    });

    document.body.appendChild(input);
})();

function handleImageToolDown(point) {
    state._imageInsertPoint = { x: point.x, y: point.y };
    // Trigger the persistent file input
    var input = document.getElementById('image-file-input');
    if (input) {
        input.click();
    }
}

// Comment tool - add comments
function handleCommentToolDown(point) {
    const comment = prompt('Votre commentaire:');
    if (!comment) return;

    const commentObj = {
        id: generateId(),
        type: 'comment',
        x: point.x,
        y: point.y,
        width: 24,
        height: 24,
        text: comment,
        author: 'Utilisateur',
        date: new Date().toISOString(),
        resolved: false,
        name: 'Commentaire'
    };

    state.objects.push(commentObj);
    state.selectedObjects = [commentObj];
    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();
    render();

    showToast('Commentaire ajouté');
}

function updateTempObject(point) {
    const obj = state.tempObject;
    if (!obj) return;

    const dx = point.x - state.startPoint.x;
    const dy = point.y - state.startPoint.y;

    if (obj.type === 'line') {
        obj.x2 = point.x;
        obj.y2 = point.y;
    } else {
        // Handle negative dimensions
        if (dx < 0) {
            obj.x = point.x;
            obj.width = -dx;
        } else {
            obj.x = state.startPoint.x;
            obj.width = dx;
        }

        if (dy < 0) {
            obj.y = point.y;
            obj.height = -dy;
        } else {
            obj.y = state.startPoint.y;
            obj.height = dy;
        }
    }
}

function finalizeObject() {
    if (state.tempObject) {
        const obj = state.tempObject;

        // Check if the object should be parented to a frame
        if (obj.type !== 'frame') {
            const parentFrame = findParentFrame(obj);
            if (parentFrame) {
                obj.parentId = parentFrame.id;
            }
        }

        // Only add if it has dimensions
        if (obj.type === 'line') {
            const dx = obj.x2 - obj.x;
            const dy = obj.y2 - obj.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                state.objects.push(obj);
                state.selectedObjects = [obj];
            }
        } else if (obj.type === 'path') {
            if (obj.points.length > 2) {
                // Calculate bounding box
                let minX = Infinity, minY = Infinity;
                let maxX = -Infinity, maxY = -Infinity;
                obj.points.forEach(p => {
                    minX = Math.min(minX, p.x);
                    minY = Math.min(minY, p.y);
                    maxX = Math.max(maxX, p.x);
                    maxY = Math.max(maxY, p.y);
                });
                obj.x = minX;
                obj.y = minY;
                obj.width = maxX - minX;
                obj.height = maxY - minY;
                state.objects.push(obj);
                state.selectedObjects = [obj];
            }
        } else if (obj.width > 5 || obj.height > 5) {
            state.objects.push(obj);
            state.selectedObjects = [obj];
        }

        saveHistory();
        updateLayersPanel();
        updatePropertiesPanel();
    }

    state.tempObject = null;
    state.isDrawing = false;
}

// Find the frame that contains an object
function findParentFrame(obj) {
    const frames = state.objects.filter(o => o.type === 'frame');

    // Check if object's center is inside a frame
    const centerX = obj.x + (obj.width || 0) / 2;
    const centerY = obj.y + (obj.height || 0) / 2;

    // Find the smallest frame containing the object (for nested frames support)
    let bestFrame = null;
    let smallestArea = Infinity;

    for (const frame of frames) {
        if (centerX >= frame.x && centerX <= frame.x + frame.width &&
            centerY >= frame.y && centerY <= frame.y + frame.height) {
            const area = frame.width * frame.height;
            if (area < smallestArea) {
                smallestArea = area;
                bestFrame = frame;
            }
        }
    }

    return bestFrame;
}

// ========================================
// SELECTION & MANIPULATION
// ========================================

function getObjectAtPoint(point) {
    // Iterate in reverse (top objects first)
    for (let i = state.objects.length - 1; i >= 0; i--) {
        const obj = state.objects[i];
        if (isPointInObject(point, obj)) {
            return obj;
        }
    }
    return null;
}

function isPointInObject(point, obj) {
    const bounds = getObjectBounds(obj);
    return point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height;
}

function getObjectBounds(obj) {
    if (obj.type === 'line') {
        const minX = Math.min(obj.x, obj.x2);
        const minY = Math.min(obj.y, obj.y2);
        const maxX = Math.max(obj.x, obj.x2);
        const maxY = Math.max(obj.y, obj.y2);
        return { x: minX - 5, y: minY - 5, width: maxX - minX + 10, height: maxY - minY + 10 };
    }

    if (obj.type === 'text') {
        state.ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
        const metrics = state.ctx.measureText(obj.text);
        const textWidth = Math.max(metrics.width, 50);
        const textHeight = obj.fontSize * 1.4;
        return {
            x: obj.x,
            y: obj.y - obj.fontSize * 0.8,
            width: textWidth,
            height: textHeight
        };
    }

    // Path (pencil) and vector (pen) objects
    if ((obj.type === 'path' || obj.type === 'vector') && obj.points && obj.points.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        obj.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        return {
            x: minX - 5,
            y: minY - 5,
            width: Math.max(maxX - minX + 10, 10),
            height: Math.max(maxY - minY + 10, 10)
        };
    }

    return { x: obj.x || 0, y: obj.y || 0, width: obj.width || 0, height: obj.height || 0 };
}

function getResizeHandleAtPoint(point) {
    if (state.selectedObjects.length !== 1) return null;

    const obj = state.selectedObjects[0];
    const bounds = getObjectBounds(obj);
    const handleSize = 8 / state.zoom;
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    const positions = {
        nw: { x: bounds.x, y: bounds.y },
        n: { x: bounds.x + bounds.width / 2, y: bounds.y },
        ne: { x: bounds.x + bounds.width, y: bounds.y },
        e: { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
        se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        s: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
        sw: { x: bounds.x, y: bounds.y + bounds.height },
        w: { x: bounds.x, y: bounds.y + bounds.height / 2 }
    };

    for (const handle of handles) {
        const pos = positions[handle];
        if (Math.abs(point.x - pos.x) < handleSize &&
            Math.abs(point.y - pos.y) < handleSize) {
            return handle;
        }
    }

    return null;
}

function handleResize(point) {
    const obj = state.selectedObjects[0];
    const start = state.resizeStartBounds;
    const handle = state.resizeHandle;

    const dx = point.x - state.startPoint.x;
    const dy = point.y - state.startPoint.y;

    switch (handle) {
        case 'nw':
            obj.x = start.x + dx;
            obj.y = start.y + dy;
            obj.width = start.width - dx;
            obj.height = start.height - dy;
            break;
        case 'n':
            obj.y = start.y + dy;
            obj.height = start.height - dy;
            break;
        case 'ne':
            obj.y = start.y + dy;
            obj.width = start.width + dx;
            obj.height = start.height - dy;
            break;
        case 'e':
            obj.width = start.width + dx;
            break;
        case 'se':
            obj.width = start.width + dx;
            obj.height = start.height + dy;
            break;
        case 's':
            obj.height = start.height + dy;
            break;
        case 'sw':
            obj.x = start.x + dx;
            obj.width = start.width - dx;
            obj.height = start.height + dy;
            break;
        case 'w':
            obj.x = start.x + dx;
            obj.width = start.width - dx;
            break;
    }

    // Prevent negative dimensions
    if (obj.width < 1) obj.width = 1;
    if (obj.height < 1) obj.height = 1;

    updatePropertiesPanel();
}

function renderSelectionBox(point) {
    const box = document.getElementById('selection-box');
    const rect = state.canvas.getBoundingClientRect();

    const startScreen = canvasToScreen(state.selectionStart);
    const endScreen = canvasToScreen(point);

    const left = Math.min(startScreen.x, endScreen.x);
    const top = Math.min(startScreen.y, endScreen.y);
    const width = Math.abs(endScreen.x - startScreen.x);
    const height = Math.abs(endScreen.y - startScreen.y);

    box.style.display = 'block';
    box.style.left = left + 'px';
    box.style.top = (top + rect.top - state.canvasWrapper.offsetTop) + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
}

function finalizeSelection(point) {
    state.isSelecting = false;
    document.getElementById('selection-box').style.display = 'none';

    const minX = Math.min(state.selectionStart.x, point.x);
    const minY = Math.min(state.selectionStart.y, point.y);
    const maxX = Math.max(state.selectionStart.x, point.x);
    const maxY = Math.max(state.selectionStart.y, point.y);

    // Select all objects within the selection box
    state.objects.forEach(obj => {
        const bounds = getObjectBounds(obj);
        if (bounds.x >= minX && bounds.x + bounds.width <= maxX &&
            bounds.y >= minY && bounds.y + bounds.height <= maxY) {
            if (!state.selectedObjects.includes(obj)) {
                state.selectedObjects.push(obj);
            }
        }
    });

    updatePropertiesPanel();
    updateLayersPanel();
}

// ========================================
// TEXT EDITING
// ========================================

function startTextEditing(obj) {
    state.isEditingText = true;
    state.editingTextObject = obj;

    // Position textarea at the text location
    const screenPos = canvasToScreen({ x: obj.x, y: obj.y });

    const textarea = document.createElement('textarea');
    textarea.className = 'text-input-overlay';
    textarea.value = obj.text === 'Texte' ? '' : obj.text; // Clear default text for editing
    textarea.placeholder = 'Saisissez votre texte...';
    textarea.style.left = screenPos.x + 'px';
    textarea.style.top = screenPos.y + 'px';
    textarea.style.fontSize = (obj.fontSize * state.zoom) + 'px';
    textarea.style.fontFamily = obj.fontFamily;
    textarea.style.color = '#ffffff';
    textarea.style.backgroundColor = 'rgba(30, 30, 30, 0.95)';
    textarea.style.minWidth = '200px';
    textarea.style.minHeight = '40px';
    textarea.style.width = 'auto';
    textarea.style.height = 'auto';
    textarea.style.zIndex = '1000';

    textarea.addEventListener('blur', () => {
        finishTextEditing(textarea);
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            finishTextEditing(textarea);
        }
        // Allow Enter for multiline text without blur
        e.stopPropagation();
    });

    // Prevent mouse events from propagating to canvas
    textarea.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });

    state.canvasWrapper.appendChild(textarea);

    // Focus and select after a short delay to ensure the element is rendered
    setTimeout(() => {
        textarea.focus();
        if (textarea.value) {
            textarea.select();
        }
    }, 10);
}

function finishTextEditing(textarea) {
    // Guard against double-call
    if (!state.isEditingText && !state.editingTextObject) {
        if (textarea && textarea.parentNode) textarea.remove();
        return;
    }

    if (state.editingTextObject) {
        const newText = textarea.value.trim();
        if (newText) {
            state.editingTextObject.text = newText;
            saveHistory();
        } else {
            // If no text entered, remove the object
            const index = state.objects.indexOf(state.editingTextObject);
            if (index > -1) {
                state.objects.splice(index, 1);
                state.selectedObjects = [];
            }
        }
    }

    state.isEditingText = false;
    state.editingTextObject = null;
    if (textarea && textarea.parentNode) textarea.remove();
    updateLayersPanel();
    render();

    // Switch to select tool after finishing text editing
    selectTool('select');
}

// ========================================
// RENDERING
// ========================================

function drawGrid(ctx) {
    const canvas = state.canvas;

    // Calculate grid size based on zoom level
    // Grid adapts: smaller grid when zoomed in, larger when zoomed out
    let baseGridSize = 10;
    let gridSize = baseGridSize * state.zoom;

    // Adjust grid size to keep it visually consistent
    while (gridSize < 10) {
        baseGridSize *= 5;
        gridSize = baseGridSize * state.zoom;
    }
    while (gridSize > 50) {
        baseGridSize /= 5;
        gridSize = baseGridSize * state.zoom;
    }

    // Calculate offset based on pan
    const offsetX = state.panX % gridSize;
    const offsetY = state.panY % gridSize;

    // Draw minor grid lines (dots or thin lines)
    ctx.beginPath();
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }

    // Horizontal lines
    for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Draw major grid lines (every 5 units)
    const majorGridSize = gridSize * 5;
    const majorOffsetX = state.panX % majorGridSize;
    const majorOffsetY = state.panY % majorGridSize;

    ctx.beginPath();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;

    // Major vertical lines
    for (let x = majorOffsetX; x < canvas.width; x += majorGridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
    }

    // Major horizontal lines
    for (let y = majorOffsetY; y < canvas.height; y += majorGridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // Draw origin crosshair (0,0 point)
    const originX = state.panX;
    const originY = state.panY;

    if (originX >= 0 && originX <= canvas.width) {
        ctx.beginPath();
        ctx.strokeStyle = '#ff5555';
        ctx.lineWidth = 1;
        ctx.moveTo(originX, 0);
        ctx.lineTo(originX, canvas.height);
        ctx.stroke();
    }

    if (originY >= 0 && originY <= canvas.height) {
        ctx.beginPath();
        ctx.strokeStyle = '#ff5555';
        ctx.lineWidth = 1;
        ctx.moveTo(0, originY);
        ctx.lineTo(canvas.width, originY);
        ctx.stroke();
    }
}

function render() {
    const ctx = state.ctx;
    const canvas = state.canvas;

    // Clear canvas with background color
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx);

    // Apply transformations
    ctx.save();
    ctx.translate(state.panX, state.panY);
    ctx.scale(state.zoom, state.zoom);

    // Draw all objects
    state.objects.forEach(obj => {
        drawObject(ctx, obj);
    });

    // Draw temporary object
    if (state.tempObject) {
        drawObject(ctx, state.tempObject);
    }

    // Draw selection
    if (state.selectedObjects.length > 0) {
        drawSelection(ctx);
    }

    ctx.restore();

    // Draw pen preview (after restore to handle its own transforms)
    if (state.penPath && state.penPath.points.length > 0) {
        drawPenPreview();
    }
}

function drawObject(ctx, obj) {
    ctx.save();
    ctx.globalAlpha = obj.opacity / 100;

    // Apply shadow effect
    if (obj.shadow) {
        const s = obj.shadow;
        const alpha = (s.opacity || 40) / 100;
        ctx.shadowOffsetX = s.x || 0;
        ctx.shadowOffsetY = s.y || 0;
        ctx.shadowBlur = s.blur || 0;
        // Convert hex color + opacity to rgba
        const r = parseInt(s.color.slice(1, 3), 16);
        const g = parseInt(s.color.slice(3, 5), 16);
        const b = parseInt(s.color.slice(5, 7), 16);
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Apply rotation
    if (obj.rotation) {
        const centerX = obj.x + (obj.width || 0) / 2;
        const centerY = obj.y + (obj.height || 0) / 2;
        ctx.translate(centerX, centerY);
        ctx.rotate(obj.rotation * Math.PI / 180);
        ctx.translate(-centerX, -centerY);
    }

    switch (obj.type) {
        case 'rectangle':
            drawRectangle(ctx, obj);
            break;
        case 'ellipse':
            drawEllipse(ctx, obj);
            break;
        case 'line':
            drawLine(ctx, obj);
            break;
        case 'polygon':
            drawPolygon(ctx, obj);
            break;
        case 'star':
            drawStar(ctx, obj);
            break;
        case 'text':
            drawText(ctx, obj);
            break;
        case 'path':
            drawPath(ctx, obj);
            break;
        case 'frame':
            drawFrameObject(ctx, obj);
            break;
        case 'image':
            drawImage(ctx, obj);
            break;
        case 'comment':
            drawComment(ctx, obj);
            break;
        case 'vector':
            drawVector(ctx, obj);
            break;
    }

    ctx.restore();
}

function drawRectangle(ctx, obj) {
    const radius = obj.cornerRadius || 0;

    ctx.beginPath();
    if (radius > 0) {
        roundRect(ctx, obj.x, obj.y, obj.width, obj.height, radius);
    } else {
        ctx.rect(obj.x, obj.y, obj.width, obj.height);
    }

    if (obj.fill && obj.fill !== 'transparent') {
        ctx.fillStyle = obj.fill;
        ctx.fill();
    }

    if (obj.strokeWidth > 0) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.stroke();
    }
}

function drawEllipse(ctx, obj) {
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const radiusX = obj.width / 2;
    const radiusY = obj.height / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);

    if (obj.fill && obj.fill !== 'transparent') {
        ctx.fillStyle = obj.fill;
        ctx.fill();
    }

    if (obj.strokeWidth > 0) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.stroke();
    }
}

function drawLine(ctx, obj) {
    ctx.beginPath();
    ctx.moveTo(obj.x, obj.y);
    ctx.lineTo(obj.x2, obj.y2);

    ctx.strokeStyle = obj.stroke || obj.fill;
    ctx.lineWidth = obj.strokeWidth || 2;
    ctx.stroke();
}

function drawPolygon(ctx, obj) {
    const sides = obj.sides || 3;
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const radius = Math.min(obj.width, obj.height) / 2;

    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();

    if (obj.fill && obj.fill !== 'transparent') {
        ctx.fillStyle = obj.fill;
        ctx.fill();
    }

    if (obj.strokeWidth > 0) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.stroke();
    }
}

function drawStar(ctx, obj) {
    const points = obj.points || 5;
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const outerRadius = Math.min(obj.width, obj.height) / 2;
    const innerRadius = outerRadius * (obj.innerRadius || 0.5);

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI / points) - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();

    if (obj.fill && obj.fill !== 'transparent') {
        ctx.fillStyle = obj.fill;
        ctx.fill();
    }

    if (obj.strokeWidth > 0) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.stroke();
    }
}

function drawText(ctx, obj) {
    ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
    ctx.fillStyle = obj.fill;
    ctx.textBaseline = 'top';
    ctx.fillText(obj.text, obj.x, obj.y);
}

function drawPath(ctx, obj) {
    if (obj.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);

    for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
    }

    if (obj.fill && obj.fill !== 'transparent') {
        ctx.fillStyle = obj.fill;
        ctx.fill();
    }

    ctx.strokeStyle = obj.stroke;
    ctx.lineWidth = obj.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
}

function drawSelection(ctx) {
    state.selectedObjects.forEach(obj => {
        const bounds = getObjectBounds(obj);

        // Selection border
        ctx.strokeStyle = '#5E5CE6';
        ctx.lineWidth = 1 / state.zoom;
        ctx.setLineDash([]);
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // Resize handles (only for single selection)
        if (state.selectedObjects.length === 1) {
            const handleSize = 8 / state.zoom;
            const handles = [
                { x: bounds.x, y: bounds.y },
                { x: bounds.x + bounds.width / 2, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
                { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
                { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
                { x: bounds.x, y: bounds.y + bounds.height },
                { x: bounds.x, y: bounds.y + bounds.height / 2 }
            ];

            handles.forEach(handle => {
                ctx.fillStyle = 'white';
                ctx.fillRect(
                    handle.x - handleSize / 2,
                    handle.y - handleSize / 2,
                    handleSize,
                    handleSize
                );
                ctx.strokeStyle = '#5E5CE6';
                ctx.strokeRect(
                    handle.x - handleSize / 2,
                    handle.y - handleSize / 2,
                    handleSize,
                    handleSize
                );
            });
        }
    });
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
}

// ========================================
// COORDINATE HELPERS
// ========================================

function getCanvasPoint(e) {
    const rect = state.canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.panX) / state.zoom;
    const y = (e.clientY - rect.top - state.panY) / state.zoom;
    return { x, y };
}

function canvasToScreen(point) {
    return {
        x: point.x * state.zoom + state.panX,
        y: point.y * state.zoom + state.panY
    };
}

// ========================================
// TOOLBAR
// ========================================

function initToolbar() {
    const toolButtons = document.querySelectorAll('.tool-btn');

    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Don't select disabled tools
            if (btn.classList.contains('disabled')) {
                showToast('Cette fonctionnalité sera bientôt disponible', 'warning');
                return;
            }
            const tool = btn.dataset.tool;
            selectTool(tool);
        });
    });

    // Present button
    const presentBtn = document.getElementById('present-btn');
    if (presentBtn) {
        presentBtn.addEventListener('click', togglePresentMode);
    }
}

// Presentation mode - fullscreen presentation of the design
function togglePresentMode() {
    state.isPresenting = !state.isPresenting;

    if (state.isPresenting) {
        enterPresentMode();
    } else {
        exitPresentMode();
    }
}

function enterPresentMode() {
    // Create presentation overlay
    const overlay = document.createElement('div');
    overlay.id = 'presentation-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #1e1e1e;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: none;
    `;

    // Create presentation canvas
    const presCanvas = document.createElement('canvas');
    presCanvas.id = 'presentation-canvas';
    presCanvas.width = window.innerWidth;
    presCanvas.height = window.innerHeight;
    overlay.appendChild(presCanvas);

    // Exit button
    const exitBtn = document.createElement('button');
    exitBtn.innerHTML = '✕ Quitter (ESC)';
    exitBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(255,255,255,0.1);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    exitBtn.addEventListener('click', togglePresentMode);
    overlay.appendChild(exitBtn);

    // Show exit button on mouse move
    let hideTimeout;
    overlay.addEventListener('mousemove', () => {
        exitBtn.style.opacity = '1';
        overlay.style.cursor = 'default';
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            exitBtn.style.opacity = '0';
            overlay.style.cursor = 'none';
        }, 2000);
    });

    document.body.appendChild(overlay);

    // Render objects on presentation canvas
    renderPresentation(presCanvas);

    // Request fullscreen
    if (overlay.requestFullscreen) {
        overlay.requestFullscreen().catch(() => {});
    }

    showToast('Mode présentation - Appuyez sur ESC pour quitter');
}

function exitPresentMode() {
    const overlay = document.getElementById('presentation-overlay');
    if (overlay) {
        overlay.remove();
    }

    // Exit fullscreen
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }

    state.isPresenting = false;
    showToast('Retour au mode édition');
}

function renderPresentation(canvas) {
    const ctx = canvas.getContext('2d');

    // Clear with background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate bounds of all objects
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.objects.forEach(obj => {
        const bounds = getObjectBounds(obj);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
    });

    if (minX === Infinity) return; // No objects

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate scale to fit content in canvas with padding
    const padding = 50;
    const scaleX = (canvas.width - padding * 2) / contentWidth;
    const scaleY = (canvas.height - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 2); // Max 2x zoom

    // Center the content
    const offsetX = (canvas.width - contentWidth * scale) / 2 - minX * scale;
    const offsetY = (canvas.height - contentHeight * scale) / 2 - minY * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw all objects (except comments in presentation)
    state.objects.forEach(obj => {
        if (obj.type !== 'comment') {
            drawObject(ctx, obj);
        }
    });

    ctx.restore();
}

function selectTool(tool) {
    // Auto-finalize pen path if switching away from pen tool
    if (state.penPath && state.penPath.points.length > 0 && tool !== 'pen') {
        finalizePenPath();
    }

    state.currentTool = tool;

    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    // Update cursor
    state.canvas.style.cursor = getCursorForTool(tool);
}

function getCursorForTool(tool) {
    switch (tool) {
        case 'select':
            return 'default';
        case 'move':
            return 'grab';
        case 'text':
            return 'text';
        case 'eraser':
            return 'crosshair';
        default:
            return 'crosshair';
    }
}

function updateCursor(point) {
    if (state.currentTool !== 'select') return;

    const handle = getResizeHandleAtPoint(point);
    if (handle) {
        const cursors = {
            nw: 'nwse-resize', ne: 'nesw-resize',
            sw: 'nesw-resize', se: 'nwse-resize',
            n: 'ns-resize', s: 'ns-resize',
            e: 'ew-resize', w: 'ew-resize'
        };
        state.canvas.style.cursor = cursors[handle];
        return;
    }

    const obj = getObjectAtPoint(point);
    state.canvas.style.cursor = obj ? 'move' : 'default';
}

// ========================================
// PANELS
// ========================================

function initPanels() {
    // Panel tabs
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const panel = tab.dataset.panel;
            document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.getElementById('layers-panel').classList.toggle('hidden', panel !== 'layers');
            document.getElementById('assets-panel').classList.toggle('hidden', panel !== 'assets');
        });
    });

    // Layer search filter
    initLayerSearch();

    // Properties panel inputs
    initPropertiesPanel();

    // Context menu actions
    initContextMenu();

    // Color picker
    initColorPicker();
}

function initLayerSearch() {
    var searchInput = document.getElementById('layer-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
        var query = this.value.toLowerCase().trim();
        var tree = document.getElementById('layers-tree');
        if (!tree) return;

        // Get ALL elements in the tree (items, containers, children divs)
        var allItems = tree.querySelectorAll('.layer-item:not(.page)');
        var allContainers = tree.querySelectorAll('.layer-frame-container');

        if (!query) {
            // Show everything
            allItems.forEach(function(el) { el.style.display = ''; });
            allContainers.forEach(function(el) { el.style.display = ''; });
            var allChildren = tree.querySelectorAll('.layer-children');
            allChildren.forEach(function(el) { el.style.display = ''; });
            return;
        }

        // First hide all containers
        allContainers.forEach(function(el) { el.style.display = 'none'; });

        // Then check each item
        allItems.forEach(function(item) {
            var nameEl = item.querySelector('.layer-name');
            var name = nameEl ? nameEl.textContent.toLowerCase() : '';
            if (name.indexOf(query) !== -1) {
                item.style.display = '';
                // Show its parent containers
                var parent = item.parentElement;
                while (parent && parent !== tree) {
                    parent.style.display = '';
                    parent = parent.parentElement;
                }
            } else {
                item.style.display = 'none';
            }
        });
    });
}

function initPropertiesPanel() {
    // Position & Size
    ['prop-x', 'prop-y', 'prop-width', 'prop-height', 'prop-rotation'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            if (state.selectedObjects.length === 0) return;

            const prop = id.replace('prop-', '');
            const value = parseFloat(e.target.value);

            state.selectedObjects.forEach(obj => {
                obj[prop] = value;
            });

            saveHistory();
            render();
        });
    });

    // Fill color
    document.getElementById('fill-color').addEventListener('change', (e) => {
        const color = e.target.value;
        document.getElementById('fill-color-preview').style.background = color;
        state.defaultFill = color;

        if (state.selectedObjects.length > 0) {
            state.selectedObjects.forEach(obj => obj.fill = color);
            saveHistory();
            render();
        }
    });

    // Fill opacity
    document.getElementById('fill-opacity').addEventListener('change', (e) => {
        const opacity = parseInt(e.target.value);
        state.defaultOpacity = opacity;

        if (state.selectedObjects.length > 0) {
            state.selectedObjects.forEach(obj => obj.opacity = opacity);
            saveHistory();
            render();
        }
    });

    // Stroke color
    document.getElementById('stroke-color').addEventListener('change', (e) => {
        const color = e.target.value;
        document.getElementById('stroke-color-preview').style.background = color;
        state.defaultStroke = color;

        if (state.selectedObjects.length > 0) {
            state.selectedObjects.forEach(obj => obj.stroke = color);
            saveHistory();
            render();
        }
    });

    // Stroke width
    document.getElementById('stroke-width').addEventListener('change', (e) => {
        const width = parseInt(e.target.value);
        state.defaultStrokeWidth = width;

        if (state.selectedObjects.length > 0) {
            state.selectedObjects.forEach(obj => obj.strokeWidth = width);
            saveHistory();
            render();
        }
    });

    // Corner radius
    ['corner-tl', 'corner-tr', 'corner-br', 'corner-bl'].forEach(id => {
        document.getElementById(id).addEventListener('change', (e) => {
            const radius = parseInt(e.target.value);
            state.defaultCornerRadius = radius;

            if (state.selectedObjects.length > 0) {
                state.selectedObjects.forEach(obj => obj.cornerRadius = radius);
                saveHistory();
                render();
            }
        });
    });

    // Color preview click
    document.getElementById('fill-color-preview').addEventListener('click', () => {
        openColorPicker('fill');
    });

    document.getElementById('stroke-color-preview').addEventListener('click', () => {
        openColorPicker('stroke');
    });

    // Effects / Shadow
    var effectEnabled = document.getElementById('effect-enabled');
    if (effectEnabled) {
        effectEnabled.addEventListener('change', function() {
            applyEffectToSelection();
        });
    }

    ['shadow-x', 'shadow-y', 'shadow-blur', 'shadow-color', 'shadow-opacity'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                applyEffectToSelection();
            });
            el.addEventListener('input', function() {
                applyEffectToSelection();
            });
        }
    });

    var effectType = document.getElementById('effect-type');
    if (effectType) {
        effectType.addEventListener('change', function() {
            applyEffectToSelection();
        });
    }
}

function applyEffectToSelection() {
    if (state.selectedObjects.length === 0) return;

    var enabledEl = document.getElementById('effect-enabled');
    var typeEl = document.getElementById('effect-type');
    var sxEl = document.getElementById('shadow-x');
    var syEl = document.getElementById('shadow-y');
    var blurEl = document.getElementById('shadow-blur');
    var colorEl = document.getElementById('shadow-color');
    var opacityEl = document.getElementById('shadow-opacity');

    var enabled = enabledEl ? enabledEl.checked : false;
    var type = typeEl ? typeEl.value : 'shadow';
    var sx = sxEl ? (parseInt(sxEl.value) || 0) : 4;
    var sy = syEl ? (parseInt(syEl.value) || 0) : 4;
    var blur = blurEl ? (parseInt(blurEl.value) || 0) : 8;
    var color = colorEl ? colorEl.value : '#000000';
    var opacity = opacityEl ? (parseInt(opacityEl.value) || 40) : 40;

    state.selectedObjects.forEach(function(obj) {
        if (enabled) {
            obj.shadow = { type: type, x: sx, y: sy, blur: blur, color: color, opacity: opacity };
        } else {
            delete obj.shadow;
        }
    });

    saveHistory();
    render();
}

function updatePropertiesPanel() {
    if (state.selectedObjects.length === 0) {
        document.getElementById('prop-x').value = 0;
        document.getElementById('prop-y').value = 0;
        document.getElementById('prop-width').value = 100;
        document.getElementById('prop-height').value = 100;
        document.getElementById('prop-rotation').value = 0;
        return;
    }

    const obj = state.selectedObjects[0];
    const bounds = getObjectBounds(obj);

    document.getElementById('prop-x').value = Math.round(bounds.x);
    document.getElementById('prop-y').value = Math.round(bounds.y);
    document.getElementById('prop-width').value = Math.round(bounds.width);
    document.getElementById('prop-height').value = Math.round(bounds.height);
    document.getElementById('prop-rotation').value = obj.rotation || 0;

    if (obj.fill) {
        document.getElementById('fill-color').value = obj.fill;
        document.getElementById('fill-color-preview').style.background = obj.fill;
    }

    if (obj.opacity !== undefined) {
        document.getElementById('fill-opacity').value = obj.opacity;
    }

    if (obj.stroke) {
        document.getElementById('stroke-color').value = obj.stroke;
        document.getElementById('stroke-color-preview').style.background = obj.stroke;
    }

    if (obj.strokeWidth !== undefined) {
        document.getElementById('stroke-width').value = obj.strokeWidth;
    }

    if (obj.cornerRadius !== undefined) {
        ['corner-tl', 'corner-tr', 'corner-br', 'corner-bl'].forEach(id => {
            document.getElementById(id).value = obj.cornerRadius;
        });
    }

    // Update shadow/effect controls
    var effectEnabledEl = document.getElementById('effect-enabled');
    if (effectEnabledEl) {
        if (obj.shadow) {
            effectEnabledEl.checked = true;
            var etEl = document.getElementById('effect-type');
            var sxEl = document.getElementById('shadow-x');
            var syEl = document.getElementById('shadow-y');
            var sbEl = document.getElementById('shadow-blur');
            var scEl = document.getElementById('shadow-color');
            var soEl = document.getElementById('shadow-opacity');
            if (etEl) etEl.value = obj.shadow.type || 'shadow';
            if (sxEl) sxEl.value = obj.shadow.x || 0;
            if (syEl) syEl.value = obj.shadow.y || 0;
            if (sbEl) sbEl.value = obj.shadow.blur || 0;
            if (scEl) scEl.value = obj.shadow.color || '#000000';
            if (soEl) soEl.value = obj.shadow.opacity || 40;
        } else {
            effectEnabledEl.checked = false;
        }
    }
}

function updateLayersPanel() {
    const tree = document.getElementById('layers-tree');
    const pageItem = tree.querySelector('.layer-item.page');

    // Remove all layer items except the page
    tree.querySelectorAll('.layer-item:not(.page), .layer-children, .layer-frame-container').forEach(el => el.remove());

    // Separate frames and other objects
    const frames = state.objects.filter(obj => obj.type === 'frame');
    const topLevelObjects = state.objects.filter(obj => obj.type !== 'frame' && !obj.parentId);

    // Render frames first (they contain children)
    [...frames].reverse().forEach(frame => {
        const frameContainer = document.createElement('div');
        frameContainer.className = 'layer-frame-container';

        const item = createLayerItem(frame, 0, true);
        frameContainer.appendChild(item);

        // Find children of this frame
        const children = state.objects.filter(obj => obj.parentId === frame.id);
        if (children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'layer-children';
            childrenContainer.dataset.frameId = frame.id;

            [...children].reverse().forEach(child => {
                const childItem = createLayerItem(child, 1, false);
                childrenContainer.appendChild(childItem);
            });

            frameContainer.appendChild(childrenContainer);
        }

        tree.appendChild(frameContainer);
    });

    // Render top-level objects (not in frames)
    [...topLevelObjects].reverse().forEach(obj => {
        const item = createLayerItem(obj, 0, false);
        tree.appendChild(item);
    });
}

function createLayerItem(obj, indent, isFrame) {
    const item = document.createElement('div');
    item.className = 'layer-item';
    if (indent > 0) {
        item.classList.add('indent-' + indent);
    }
    if (isFrame) {
        item.classList.add('frame-item');
    }
    if (state.selectedObjects.includes(obj)) {
        item.classList.add('selected');
    }
    item.dataset.id = obj.id;

    const icon = getIconForType(obj.type);
    const hasChildren = isFrame && state.objects.some(o => o.parentId === obj.id);

    item.innerHTML = `
        ${hasChildren ? '<span class="layer-toggle">▼</span>' : '<span class="layer-toggle-placeholder" style="width:16px"></span>'}
        <span class="layer-icon">${icon}</span>
        <span class="layer-name">${obj.name}</span>
        <span class="layer-visibility">👁</span>
    `;

    // Toggle collapse/expand for frames
    const toggle = item.querySelector('.layer-toggle');
    if (toggle) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const container = item.parentElement;
            const children = container.querySelector('.layer-children');
            if (children) {
                toggle.classList.toggle('collapsed');
                children.classList.toggle('collapsed');
            }
        });
    }

    // Selection handler
    item.addEventListener('click', (e) => {
        if (e.target.classList.contains('layer-toggle')) return;

        if (e.shiftKey) {
            const index = state.selectedObjects.indexOf(obj);
            if (index > -1) {
                state.selectedObjects.splice(index, 1);
            } else {
                state.selectedObjects.push(obj);
            }
        } else {
            state.selectedObjects = [obj];
        }
        updatePropertiesPanel();
        updateLayersPanel();
        render();
    });

    return item;
}

function getIconForType(type) {
    const icons = {
        rectangle: '⬛',
        ellipse: '⚫',
        line: '📏',
        polygon: '🔺',
        star: '⭐',
        text: '📝',
        path: '✏️',
        frame: '📱',
        image: '🖼️',
        comment: '💬',
        vector: '✒️'
    };
    return icons[type] || '📦';
}

function initContextMenu() {
    document.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            handleContextMenuAction(action);
            hideContextMenu();
        });
    });
}

function handleContextMenuAction(action) {
    switch (action) {
        case 'copy':
            copySelection();
            break;
        case 'paste':
            pasteClipboard();
            break;
        case 'duplicate':
            duplicateSelection();
            break;
        case 'delete':
            deleteSelection();
            break;
        case 'bring-front':
            bringToFront();
            break;
        case 'send-back':
            sendToBack();
            break;
        case 'group':
            groupSelection();
            break;
        case 'ungroup':
            ungroupSelection();
            break;
    }
}

// ========================================
// COLOR PICKER
// ========================================

let currentColorTarget = null;
let currentHue = 0;
let currentSaturation = 0.74;
let currentBrightness = 0.63;
let currentAlpha = 100;
let gradientStops = [
    { position: 0, color: '#5e5ce6' },
    { position: 100, color: '#00d4ff' }
];
let activeGradientStop = 1;

function initColorPicker() {
    const modal = document.getElementById('color-picker-modal');
    const modalContent = modal.querySelector('.color-picker');
    const gradient = document.getElementById('color-gradient');
    const hue = document.getElementById('color-hue');
    const alpha = document.getElementById('color-alpha');
    const closeBtn = modal.querySelector('.close-modal');
    const header = modal.querySelector('.color-picker-header');

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    // Make modal draggable
    let isDraggingModal = false;
    let modalDragOffset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
        if (e.target === closeBtn || e.target.closest('.close-modal')) return;
        isDraggingModal = true;
        const rect = modalContent.getBoundingClientRect();
        modalDragOffset.x = e.clientX - rect.left;
        modalDragOffset.y = e.clientY - rect.top;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingModal) return;
        const x = e.clientX - modalDragOffset.x;
        const y = e.clientY - modalDragOffset.y;
        modalContent.style.left = x + 'px';
        modalContent.style.top = y + 'px';
        modalContent.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDraggingModal = false;
    });

    // Color/Gradient tab switching
    document.querySelectorAll('.color-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.color-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabName = tab.dataset.tab;
            document.querySelectorAll('.color-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tabName + '-tab').classList.add('active');
        });
    });

    // Color mode tabs (HEX, RGB, HSL)
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const mode = tab.dataset.mode;
            document.querySelectorAll('.color-mode-content').forEach(c => c.classList.remove('active'));
            document.getElementById(mode + '-mode').classList.add('active');
        });
    });

    // Gradient interaction
    let isDraggingGradient = false;
    gradient.addEventListener('mousedown', (e) => {
        isDraggingGradient = true;
        updateGradientColor(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingGradient) updateGradientColor(e);
    });

    document.addEventListener('mouseup', () => {
        isDraggingGradient = false;
    });

    // Hue interaction
    let isDraggingHue = false;
    hue.addEventListener('mousedown', (e) => {
        isDraggingHue = true;
        updateHueColor(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingHue) updateHueColor(e);
    });

    document.addEventListener('mouseup', () => {
        isDraggingHue = false;
    });

    // Alpha interaction
    let isDraggingAlpha = false;
    if (alpha) {
        alpha.addEventListener('mousedown', (e) => {
            isDraggingAlpha = true;
            updateAlphaColor(e);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDraggingAlpha) updateAlphaColor(e);
        });

        document.addEventListener('mouseup', () => {
            isDraggingAlpha = false;
        });
    }

    // Input changes
    document.getElementById('hex-input')?.addEventListener('change', (e) => {
        const color = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
            applyColorFromPicker(color);
            updateColorFromHex(color);
        }
    });

    // RGB inputs
    ['r-input', 'g-input', 'b-input'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            const r = parseInt(document.getElementById('r-input').value) || 0;
            const g = parseInt(document.getElementById('g-input').value) || 0;
            const b = parseInt(document.getElementById('b-input').value) || 0;
            const hex = rgbToHex(r, g, b);
            applyColorFromPicker(hex);
            updateColorFromHex(hex);
        });
    });

    // HSL inputs
    ['h-input', 's-input', 'l-input'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            const h = parseInt(document.getElementById('h-input').value) || 0;
            const s = parseInt(document.getElementById('s-input').value) || 0;
            const l = parseInt(document.getElementById('l-input').value) || 0;
            const hex = hslToHex(h, s, l);
            applyColorFromPicker(hex);
            updateColorFromHex(hex);
        });
    });

    // Alpha input
    document.getElementById('alpha-input')?.addEventListener('change', (e) => {
        currentAlpha = parseInt(e.target.value) || 100;
        updateAlphaCursor();
        updateColorPreview();
    });

    // Gradient controls
    document.getElementById('gradient-type')?.addEventListener('change', updateGradientPreview);
    document.getElementById('gradient-angle')?.addEventListener('change', updateGradientPreview);
    document.getElementById('gradient-stop-color')?.addEventListener('input', (e) => {
        if (gradientStops[activeGradientStop]) {
            gradientStops[activeGradientStop].color = e.target.value;
            updateGradientPreview();
        }
    });

    // Gradient stop clicks
    document.querySelectorAll('.gradient-stop').forEach((stop, index) => {
        stop.addEventListener('click', () => {
            document.querySelectorAll('.gradient-stop').forEach(s => s.classList.remove('active'));
            stop.classList.add('active');
            activeGradientStop = index;
            document.getElementById('gradient-stop-color').value = gradientStops[index].color;
        });
    });
}

function openColorPicker(target) {
    currentColorTarget = target;
    document.getElementById('color-picker-modal').classList.remove('hidden');

    // Set current color
    let currentColor;
    if (target === 'fill') {
        currentColor = document.getElementById('fill-color').value;
    } else {
        currentColor = document.getElementById('stroke-color').value;
    }

    updateColorFromHex(currentColor);
}

function updateColorFromHex(hex) {
    // Update hex input
    document.getElementById('hex-input').value = hex;

    // Update RGB inputs
    const rgb = hexToRgb(hex);
    if (rgb) {
        document.getElementById('r-input').value = rgb.r;
        document.getElementById('g-input').value = rgb.g;
        document.getElementById('b-input').value = rgb.b;
    }

    // Update HSL inputs
    const hsl = hexToHsl(hex);
    if (hsl) {
        document.getElementById('h-input').value = Math.round(hsl.h);
        document.getElementById('s-input').value = Math.round(hsl.s);
        document.getElementById('l-input').value = Math.round(hsl.l);
        currentHue = hsl.h;
    }

    // Update gradient background
    const gradient = document.getElementById('color-gradient');
    gradient.style.background = `linear-gradient(to right, #fff, hsl(${currentHue}, 100%, 50%))`;

    // Update color preview
    updateColorPreview();
}

function updateGradientColor(e) {
    const gradient = document.getElementById('color-gradient');
    const rect = gradient.getBoundingClientRect();
    const cursor = document.getElementById('color-cursor');

    let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    let y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';

    currentSaturation = x / rect.width;
    currentBrightness = 1 - y / rect.height;
    const color = hsbToHex(currentHue, currentSaturation, currentBrightness);

    applyColorFromPicker(color);
    updateAllColorInputs(color);
}

function updateHueColor(e) {
    const hueBar = document.getElementById('color-hue');
    const rect = hueBar.getBoundingClientRect();
    const cursor = document.getElementById('hue-cursor');

    let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    cursor.style.left = x + 'px';

    currentHue = (x / rect.width) * 360;

    // Update gradient background
    const gradient = document.getElementById('color-gradient');
    gradient.style.background = `linear-gradient(to right, #fff, hsl(${currentHue}, 100%, 50%))`;

    const color = hsbToHex(currentHue, currentSaturation, currentBrightness);
    applyColorFromPicker(color);
    updateAllColorInputs(color);
}

function updateAlphaColor(e) {
    const alphaBar = document.getElementById('color-alpha');
    const rect = alphaBar.getBoundingClientRect();
    const cursor = document.getElementById('alpha-cursor');

    let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    cursor.style.left = x + 'px';

    currentAlpha = Math.round((x / rect.width) * 100);
    document.getElementById('alpha-input').value = currentAlpha;
    updateColorPreview();
}

function updateAlphaCursor() {
    const cursor = document.getElementById('alpha-cursor');
    const alphaBar = document.getElementById('color-alpha');
    if (cursor && alphaBar) {
        const width = alphaBar.offsetWidth;
        cursor.style.left = (currentAlpha / 100 * width) + 'px';
    }
}

function updateColorPreview() {
    const preview = document.getElementById('color-preview-current');
    const color = hsbToHex(currentHue, currentSaturation, currentBrightness);
    if (preview) {
        preview.style.backgroundColor = color;
        preview.style.opacity = currentAlpha / 100;
    }

    // Update alpha bar color
    const alphaBar = document.getElementById('color-alpha');
    if (alphaBar) {
        alphaBar.style.setProperty('--current-color', color);
    }
}

function updateAllColorInputs(hex) {
    document.getElementById('hex-input').value = hex;

    const rgb = hexToRgb(hex);
    if (rgb) {
        document.getElementById('r-input').value = rgb.r;
        document.getElementById('g-input').value = rgb.g;
        document.getElementById('b-input').value = rgb.b;
    }

    const hsl = hexToHsl(hex);
    if (hsl) {
        document.getElementById('h-input').value = Math.round(hsl.h);
        document.getElementById('s-input').value = Math.round(hsl.s);
        document.getElementById('l-input').value = Math.round(hsl.l);
    }

    updateColorPreview();
}

function updateGradientPreview() {
    const type = document.getElementById('gradient-type').value;
    const angle = document.getElementById('gradient-angle').value;
    const preview = document.getElementById('gradient-preview');
    const bar = document.getElementById('gradient-bar');

    const stopsStr = gradientStops.map(s => `${s.color} ${s.position}%`).join(', ');

    let gradientCSS;
    if (type === 'linear') {
        gradientCSS = `linear-gradient(${angle}deg, ${stopsStr})`;
    } else {
        gradientCSS = `radial-gradient(circle, ${stopsStr})`;
    }

    preview.style.background = gradientCSS;
    bar.style.background = `linear-gradient(90deg, ${stopsStr})`;
}

function applyColorFromPicker(color) {
    if (currentColorTarget === 'fill') {
        document.getElementById('fill-color').value = color;
        document.getElementById('fill-color-preview').style.background = color;
        state.defaultFill = color;

        if (state.selectedObjects.length > 0) {
            state.selectedObjects.forEach(obj => obj.fill = color);
            render();
        }
    } else if (currentColorTarget === 'stroke') {
        document.getElementById('stroke-color').value = color;
        document.getElementById('stroke-color-preview').style.background = color;
        state.defaultStroke = color;

        if (state.selectedObjects.length > 0) {
            state.selectedObjects.forEach(obj => obj.stroke = color);
            render();
        }
    }
}

// Color conversion functions
function hsbToHex(h, s, b) {
    const c = b * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = b - c;

    let r, g, bl;
    if (h < 60) { r = c; g = x; bl = 0; }
    else if (h < 120) { r = x; g = c; bl = 0; }
    else if (h < 180) { r = 0; g = c; bl = x; }
    else if (h < 240) { r = 0; g = x; bl = c; }
    else if (h < 300) { r = x; g = 0; bl = c; }
    else { r = c; g = 0; bl = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    bl = Math.round((bl + m) * 255);

    return '#' + [r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => {
        const hex = Math.max(0, Math.min(255, v)).toString(16);
        return hex.padStart(2, '0');
    }).join('');
}

function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;

    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ========================================
// KEYBOARD SHORTCUTS
// ========================================

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if editing text
        if (state.isEditingText) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Tool shortcuts
        const toolShortcuts = {
            'v': 'select',
            'h': 'move',
            'f': 'frame',
            'r': 'rectangle',
            'o': 'ellipse',
            'l': 'line',
            't': 'text',
            'p': 'pen',
            'e': 'eraser',
            'c': 'comment'
        };

        if (toolShortcuts[e.key.toLowerCase()]) {
            selectTool(toolShortcuts[e.key.toLowerCase()]);
            return;
        }

        // Ctrl/Cmd shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z':
                    if (e.shiftKey) {
                        redo();
                    } else {
                        undo();
                    }
                    e.preventDefault();
                    break;
                case 'y':
                    redo();
                    e.preventDefault();
                    break;
                case 'c':
                    copySelection();
                    e.preventDefault();
                    break;
                case 'v':
                    pasteClipboard();
                    e.preventDefault();
                    break;
                case 'x':
                    cutSelection();
                    e.preventDefault();
                    break;
                case 'd':
                    duplicateSelection();
                    e.preventDefault();
                    break;
                case 'a':
                    selectAll();
                    e.preventDefault();
                    break;
                case 'g':
                    if (e.shiftKey) {
                        ungroupSelection();
                    } else {
                        groupSelection();
                    }
                    e.preventDefault();
                    break;
                case '=':
                case '+':
                    zoomIn();
                    e.preventDefault();
                    break;
                case '-':
                    zoomOut();
                    e.preventDefault();
                    break;
                case '0':
                    resetZoom();
                    e.preventDefault();
                    break;
                case 's':
                    document.getElementById('save-file')?.click();
                    e.preventDefault();
                    break;
                case 'o':
                    document.getElementById('open-file')?.click();
                    e.preventDefault();
                    break;
            }
            return;
        }

        // Other shortcuts
        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                deleteSelection();
                e.preventDefault();
                break;
            case 'Escape':
                // Exit presentation mode if active
                if (state.isPresenting) {
                    exitPresentMode();
                }
                // Cancel pen path if active
                else if (state.penPath) {
                    state.penPath = null;
                    render();
                } else {
                    state.selectedObjects = [];
                    updatePropertiesPanel();
                    updateLayersPanel();
                    render();
                }
                break;
            case 'Enter':
                // Finalize pen path if active
                if (state.penPath) {
                    finalizePenPath();
                    e.preventDefault();
                }
                break;
            case '[':
                sendBackward();
                break;
            case ']':
                bringForward();
                break;
        }
    });

    // Track space key for panning
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.spaceKey = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            e.spaceKey = false;
        }
    });
}

// ========================================
// ACTIONS
// ========================================

function copySelection() {
    if (state.selectedObjects.length === 0) return;
    state.clipboard = state.selectedObjects.map(obj => ({ ...obj }));
    showToast('Copié!');
}

function pasteClipboard() {
    if (state.clipboard.length === 0) return;

    const newObjects = state.clipboard.map(obj => ({
        ...obj,
        id: generateId(),
        x: obj.x + 20,
        y: obj.y + 20,
        name: obj.name + ' (copie)'
    }));

    state.objects.push(...newObjects);
    state.selectedObjects = newObjects;
    state.clipboard = newObjects.map(obj => ({ ...obj }));

    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();
    render();
    showToast('Collé!');
}

function cutSelection() {
    copySelection();
    deleteSelection();
}

function duplicateSelection() {
    if (state.selectedObjects.length === 0) return;

    const newObjects = state.selectedObjects.map(obj => ({
        ...obj,
        id: generateId(),
        x: obj.x + 20,
        y: obj.y + 20,
        name: obj.name + ' (copie)'
    }));

    state.objects.push(...newObjects);
    state.selectedObjects = newObjects;

    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();
    render();
}

function deleteSelection() {
    if (state.selectedObjects.length === 0) return;

    state.selectedObjects.forEach(obj => {
        const index = state.objects.indexOf(obj);
        if (index > -1) {
            state.objects.splice(index, 1);
        }
    });

    state.selectedObjects = [];
    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();
    render();
    showToast('Supprimé!');
}

function selectAll() {
    state.selectedObjects = [...state.objects];
    updateLayersPanel();
    updatePropertiesPanel();
    render();
}

function bringToFront() {
    if (state.selectedObjects.length === 0) return;

    state.selectedObjects.forEach(obj => {
        const index = state.objects.indexOf(obj);
        if (index > -1) {
            state.objects.splice(index, 1);
            state.objects.push(obj);
        }
    });

    saveHistory();
    updateLayersPanel();
    render();
}

function sendToBack() {
    if (state.selectedObjects.length === 0) return;

    state.selectedObjects.forEach(obj => {
        const index = state.objects.indexOf(obj);
        if (index > -1) {
            state.objects.splice(index, 1);
            state.objects.unshift(obj);
        }
    });

    saveHistory();
    updateLayersPanel();
    render();
}

function bringForward() {
    if (state.selectedObjects.length !== 1) return;

    const obj = state.selectedObjects[0];
    const index = state.objects.indexOf(obj);

    if (index < state.objects.length - 1) {
        state.objects.splice(index, 1);
        state.objects.splice(index + 1, 0, obj);
        saveHistory();
        updateLayersPanel();
        render();
    }
}

function sendBackward() {
    if (state.selectedObjects.length !== 1) return;

    const obj = state.selectedObjects[0];
    const index = state.objects.indexOf(obj);

    if (index > 0) {
        state.objects.splice(index, 1);
        state.objects.splice(index - 1, 0, obj);
        saveHistory();
        updateLayersPanel();
        render();
    }
}

function groupSelection() {
    // Simplified grouping (TODO: implement proper grouping)
    showToast('Groupage en cours de développement');
}

function ungroupSelection() {
    showToast('Dégroupage en cours de développement');
}

function zoomIn() {
    state.zoom = Math.min(state.zoom * 1.2, 10);
    document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
    render();
}

function zoomOut() {
    state.zoom = Math.max(state.zoom / 1.2, 0.1);
    document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
    render();
}

function resetZoom() {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    document.getElementById('zoom-level').textContent = '100%';
    render();
}

// ========================================
// HISTORY (UNDO/REDO)
// ========================================

function saveHistory() {
    // Remove any future history if we're not at the end
    state.history = state.history.slice(0, state.historyIndex + 1);

    // Save current state
    state.history.push(JSON.stringify(state.objects));
    state.historyIndex = state.history.length - 1;

    // Limit history size
    if (state.history.length > 50) {
        state.history.shift();
        state.historyIndex--;
    }
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        state.objects = JSON.parse(state.history[state.historyIndex]);
        state.selectedObjects = [];
        updateLayersPanel();
        updatePropertiesPanel();
        render();
        showToast('Annulé');
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        state.objects = JSON.parse(state.history[state.historyIndex]);
        state.selectedObjects = [];
        updateLayersPanel();
        updatePropertiesPanel();
        render();
        showToast('Rétabli');
    }
}

// ========================================
// UTILITIES
// ========================================

function generateId() {
    return 'obj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function getObjectName(type) {
    state.layerCounter++;
    const names = {
        rectangle: 'Rectangle',
        ellipse: 'Ellipse',
        line: 'Ligne',
        polygon: 'Polygone',
        star: 'Étoile',
        text: 'Texte',
        path: 'Tracé',
        frame: 'Cadre'
    };
    return `${names[type] || 'Objet'} ${state.layerCounter}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// ========================================
// MENU ACTIONS
// ========================================

// File menu
document.getElementById('new-file')?.addEventListener('click', () => {
    if (confirm('Créer un nouveau fichier? Les changements non sauvegardés seront perdus.')) {
        state.objects = [];
        state.selectedObjects = [];
        state.history = [];
        state.historyIndex = -1;
        saveHistory();
        updateLayersPanel();
        render();
        showToast('Nouveau fichier créé');
    }
});

// Open file handler
document.getElementById('open-file')?.addEventListener('click', async () => {
    // Try to use the native File System Access API
    if ('showOpenFilePicker' in window) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'DesigneMe File',
                    accept: { 'application/json': ['.figclone', '.json'] }
                }],
                multiple: false
            });

            const file = await handle.getFile();
            const contents = await file.text();
            const data = JSON.parse(contents);

            if (data.objects) {
                state.objects = data.objects;
                state.selectedObjects = [];
                state.history = [];
                state.historyIndex = -1;
                saveHistory();

                // Update file name
                const fileName = file.name.replace(/\.(figclone|json)$/, '');
                document.getElementById('file-name').value = fileName;

                updateLayersPanel();
                updatePropertiesPanel();
                render();
                showToast('Fichier ouvert!', 'success');
            } else {
                showToast('Format de fichier invalide', 'error');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error opening file:', err);
                showToast('Erreur lors de l\'ouverture', 'error');
            }
        }
    } else {
        // Fallback for browsers without File System Access API
        fallbackOpenFile();
    }
});

function fallbackOpenFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.figclone,.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const contents = await file.text();
            const data = JSON.parse(contents);

            if (data.objects) {
                state.objects = data.objects;
                state.selectedObjects = [];
                state.history = [];
                state.historyIndex = -1;
                saveHistory();

                const fileName = file.name.replace(/\.(figclone|json)$/, '');
                document.getElementById('file-name').value = fileName;

                updateLayersPanel();
                updatePropertiesPanel();
                render();
                showToast('Fichier ouvert!', 'success');
            } else {
                showToast('Format de fichier invalide', 'error');
            }
        } catch (err) {
            console.error('Error opening file:', err);
            showToast('Erreur lors de l\'ouverture', 'error');
        }
    };

    input.click();
}

document.getElementById('save-file')?.addEventListener('click', async () => {
    const data = JSON.stringify({
        objects: state.objects,
        version: '1.0'
    }, null, 2);

    // Try to use the native File System Access API
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: document.getElementById('file-name').value + '.figclone',
                types: [{
                    description: 'DesigneMe File',
                    accept: { 'application/json': ['.figclone'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(data);
            await writable.close();

            // Update file name from the selected file
            const fileName = handle.name.replace('.figclone', '');
            document.getElementById('file-name').value = fileName;

            autoSaveToRecent();
            showToast('Fichier sauvegardé!', 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error saving file:', err);
                // Fallback to download method
                fallbackSaveFile(data);
            }
        }
    } else {
        // Fallback for browsers without File System Access API
        fallbackSaveFile(data);
    }
});

function fallbackSaveFile(data) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = document.getElementById('file-name').value + '.figclone';
    a.click();
    URL.revokeObjectURL(url);
    autoSaveToRecent();
    showToast('Fichier sauvegardé!', 'success');
}

document.getElementById('export-file')?.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    const bounds = calculateBoundingBox();

    if (!bounds) {
        showToast('Rien à exporter', 'warning');
        return;
    }

    tempCanvas.width = bounds.width + 40;
    tempCanvas.height = bounds.height + 40;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    tempCtx.translate(-bounds.x + 20, -bounds.y + 20);

    state.objects.forEach(obj => drawObject(tempCtx, obj));

    const url = tempCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = document.getElementById('file-name').value + '.png';
    a.click();
    showToast('Exporté en PNG!', 'success');
});

function calculateBoundingBox() {
    if (state.objects.length === 0) return null;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    state.objects.forEach(obj => {
        const bounds = getObjectBounds(obj);
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.width);
        maxY = Math.max(maxY, bounds.y + bounds.height);
    });

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

// Zoom menu
document.getElementById('zoom-in')?.addEventListener('click', zoomIn);
document.getElementById('zoom-out')?.addEventListener('click', zoomOut);
document.getElementById('zoom-100')?.addEventListener('click', resetZoom);
document.getElementById('zoom-fit')?.addEventListener('click', () => {
    const bounds = calculateBoundingBox();
    if (!bounds) return;

    const padding = 50;
    const scaleX = (state.canvas.width - padding * 2) / bounds.width;
    const scaleY = (state.canvas.height - padding * 2) / bounds.height;
    state.zoom = Math.min(scaleX, scaleY, 2);

    state.panX = (state.canvas.width - bounds.width * state.zoom) / 2 - bounds.x * state.zoom;
    state.panY = (state.canvas.height - bounds.height * state.zoom) / 2 - bounds.y * state.zoom;

    document.getElementById('zoom-level').textContent = Math.round(state.zoom * 100) + '%';
    render();
});

// Edit menu
document.getElementById('undo-action')?.addEventListener('click', undo);
document.getElementById('redo-action')?.addEventListener('click', redo);
document.getElementById('copy-action')?.addEventListener('click', copySelection);
document.getElementById('paste-action')?.addEventListener('click', pasteClipboard);
document.getElementById('delete-action')?.addEventListener('click', deleteSelection);

// Help modal
document.getElementById('help-btn')?.addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('hidden');
});

document.getElementById('close-help')?.addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
});

document.getElementById('help-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'help-modal') {
        document.getElementById('help-modal').classList.add('hidden');
    }
});

// Keyboard shortcut to open help (?)
document.addEventListener('keydown', (e) => {
    if (e.key === '?' && !state.isEditingText && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        document.getElementById('help-modal').classList.toggle('hidden');
    }
});

// New file button (icon)
document.getElementById('new-file-btn')?.addEventListener('click', () => {
    if (confirm('Créer un nouveau fichier? Les changements non sauvegardés seront perdus.')) {
        state.objects = [];
        state.selectedObjects = [];
        state.history = [];
        state.historyIndex = -1;
        state.layerCounter = 0;
        saveHistory();
        updateLayersPanel();
        render();
        showToast('Nouveau fichier créé');
    }
});

// Frame modal
document.getElementById('close-frame')?.addEventListener('click', () => {
    document.getElementById('frame-modal').classList.add('hidden');
});

document.getElementById('frame-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'frame-modal') {
        document.getElementById('frame-modal').classList.add('hidden');
    }
});

// Open frame modal when clicking frame tool
document.querySelector('[data-tool="frame"]')?.addEventListener('dblclick', () => {
    document.getElementById('frame-modal').classList.remove('hidden');
});

// Frame options click
document.querySelectorAll('.frame-option').forEach(option => {
    option.addEventListener('click', () => {
        const width = parseInt(option.dataset.width);
        const height = parseInt(option.dataset.height);
        const name = option.querySelector('span').textContent;

        createFrame(width, height, name);
        document.getElementById('frame-modal').classList.add('hidden');
    });
});

function createFrame(width, height, name) {
    // Center the frame in the viewport
    const canvasRect = state.canvas.getBoundingClientRect();
    const centerX = (canvasRect.width / 2 - state.panX) / state.zoom - width / 2;
    const centerY = (canvasRect.height / 2 - state.panY) / state.zoom - height / 2;

    const frame = {
        id: generateId(),
        type: 'frame',
        x: centerX,
        y: centerY,
        width: width,
        height: height,
        fill: '#ffffff',
        stroke: '#cccccc',
        strokeWidth: 1,
        opacity: 100,
        rotation: 0,
        cornerRadius: 0,
        name: name || `Frame ${state.layerCounter + 1}`
    };

    state.layerCounter++;
    state.objects.push(frame);
    state.selectedObjects = [frame];

    // Switch back to select tool
    selectTool('select');

    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();
    render();

    showToast(`Frame "${name}" créé`);
}

// Add frame drawing function
function drawFrameObject(ctx, obj) {
    // Draw white background
    ctx.fillStyle = obj.fill || '#ffffff';
    ctx.fillRect(obj.x, obj.y, obj.width, obj.height);

    // Draw border
    ctx.strokeStyle = obj.stroke || '#cccccc';
    ctx.lineWidth = obj.strokeWidth || 1;
    ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

    // Draw frame name label
    ctx.save();
    ctx.fillStyle = '#888888';
    ctx.font = `${12 / state.zoom}px Inter, sans-serif`;
    ctx.fillText(obj.name, obj.x, obj.y - 8 / state.zoom);
    ctx.restore();
}

// Draw image object
function drawImage(ctx, obj) {
    if (!obj.imageElement) {
        // Create and cache the image element
        obj.imageElement = new Image();
        obj.imageElement.src = obj.src;
    }

    if (obj.imageElement.complete) {
        ctx.drawImage(obj.imageElement, obj.x, obj.y, obj.width, obj.height);
    }

    // Draw border if stroke is set
    if (obj.strokeWidth > 0) {
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
    }
}

// Draw comment marker
function drawComment(ctx, obj) {
    const size = 24;

    // Draw comment bubble
    ctx.beginPath();
    ctx.fillStyle = '#ffcc00';
    ctx.arc(obj.x + size / 2, obj.y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = '#cc9900';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw comment icon
    ctx.fillStyle = '#664400';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💬', obj.x + size / 2, obj.y + size / 2);
}

// Draw vector path (pen tool)
function drawVector(ctx, obj) {
    if (!obj.points || obj.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(obj.points[0].x, obj.points[0].y);

    for (let i = 1; i < obj.points.length; i++) {
        ctx.lineTo(obj.points[i].x, obj.points[i].y);
    }

    if (obj.closed) {
        ctx.closePath();
    }

    if (obj.fill && obj.fill !== 'transparent') {
        ctx.fillStyle = obj.fill;
        ctx.fill();
    }

    ctx.strokeStyle = obj.stroke;
    ctx.lineWidth = obj.strokeWidth;
    ctx.stroke();
}

// Initialize history
saveHistory();

// ========================================
// RESIZABLE PANELS
// ========================================

function initResizablePanels() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const leftHandle = document.getElementById('left-resize-handle');
    const rightHandle = document.getElementById('right-resize-handle');

    let isResizing = false;
    let currentPanel = null;
    let startX = 0;
    let startWidth = 0;

    function startResize(e, panel, handle) {
        isResizing = true;
        currentPanel = panel;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        handle.classList.add('active');
        document.body.classList.add('resizing-panels');
        e.preventDefault();
    }

    function doResize(e) {
        if (!isResizing) return;

        const dx = e.clientX - startX;
        let newWidth;

        if (currentPanel === leftPanel) {
            newWidth = startWidth + dx;
        } else {
            newWidth = startWidth - dx;
        }

        // Clamp width between min and max
        newWidth = Math.max(180, Math.min(400, newWidth));
        currentPanel.style.width = newWidth + 'px';
    }

    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        currentPanel = null;
        leftHandle.classList.remove('active');
        rightHandle.classList.remove('active');
        document.body.classList.remove('resizing-panels');

        // Trigger canvas resize
        resizeCanvas();
    }

    if (leftHandle) {
        leftHandle.addEventListener('mousedown', (e) => startResize(e, leftPanel, leftHandle));
    }

    if (rightHandle) {
        rightHandle.addEventListener('mousedown', (e) => startResize(e, rightPanel, rightHandle));
    }

    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
}

// Initialize resizable panels when DOM is ready
document.addEventListener('DOMContentLoaded', initResizablePanels);

// ========================================
// HOME MODAL & RECENT PROJECTS
// ========================================

const RECENT_PROJECTS_KEY = 'figclone_recent_projects';

function initHomeModal() {
    const homeModal = document.getElementById('home-modal');
    const closeBtn = document.getElementById('close-home');

    // Close button
    closeBtn?.addEventListener('click', () => {
        homeModal.classList.add('hidden');
    });

    // Click outside to close
    homeModal?.addEventListener('click', (e) => {
        if (e.target === homeModal) {
            homeModal.classList.add('hidden');
        }
    });

    // New blank project
    document.getElementById('new-blank-project')?.addEventListener('click', () => {
        startNewProject();
        homeModal.classList.add('hidden');
    });

    // New project with frame
    ['new-desktop-project', 'new-tablet-project', 'new-mobile-project'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const width = parseInt(btn.dataset.width);
            const height = parseInt(btn.dataset.height);
            const name = btn.querySelector('span').textContent;

            startNewProject();
            createFrame(width, height, name);
            homeModal.classList.add('hidden');
        });
    });

    // Load recent projects
    loadRecentProjects();

    // Show home modal on startup (only if no objects)
    if (state.objects.length === 0) {
        homeModal.classList.remove('hidden');
    }
}

function startNewProject() {
    state.objects = [];
    state.selectedObjects = [];
    state.history = [];
    state.historyIndex = -1;
    state.layerCounter = 0;
    document.getElementById('file-name').value = 'Sans titre';
    saveHistory();
    updateLayersPanel();
    updatePropertiesPanel();
    render();
}

function loadRecentProjects() {
    const container = document.getElementById('recent-projects');
    if (!container) return;

    const recentProjects = getRecentProjects();

    if (recentProjects.length === 0) {
        container.innerHTML = `
            <div class="empty-recent">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
                </svg>
                <p>Aucun fichier récent</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    recentProjects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'recent-project-item';
        item.innerHTML = `
            <div class="recent-project-thumbnail"></div>
            <div class="recent-project-info">
                <div class="recent-project-name">${project.name}</div>
                <div class="recent-project-date">${formatDate(project.date)}</div>
            </div>
            <button class="recent-project-delete" title="Supprimer">✕</button>
        `;

        // Open project
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('recent-project-delete')) return;
            loadProjectFromRecent(project);
            document.getElementById('home-modal').classList.add('hidden');
        });

        // Delete project
        item.querySelector('.recent-project-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            removeFromRecentProjects(project.id);
            loadRecentProjects();
        });

        container.appendChild(item);
    });
}

function getRecentProjects() {
    try {
        const data = localStorage.getItem(RECENT_PROJECTS_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

function saveToRecentProjects(name, objects) {
    const recentProjects = getRecentProjects();
    const project = {
        id: Date.now().toString(),
        name: name,
        date: new Date().toISOString(),
        data: JSON.stringify({ objects: objects, version: '1.0' })
    };

    // Remove existing project with same name
    const existingIndex = recentProjects.findIndex(p => p.name === name);
    if (existingIndex > -1) {
        recentProjects.splice(existingIndex, 1);
    }

    // Add to beginning
    recentProjects.unshift(project);

    // Keep only last 10 projects
    const trimmed = recentProjects.slice(0, 10);

    try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(trimmed));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

function removeFromRecentProjects(id) {
    const recentProjects = getRecentProjects();
    const filtered = recentProjects.filter(p => p.id !== id);
    localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(filtered));
}

function loadProjectFromRecent(project) {
    try {
        const data = JSON.parse(project.data);
        if (data.objects) {
            state.objects = data.objects;
            state.selectedObjects = [];
            state.history = [];
            state.historyIndex = -1;
            saveHistory();

            document.getElementById('file-name').value = project.name;

            updateLayersPanel();
            updatePropertiesPanel();
            render();
            showToast('Fichier ouvert!', 'success');
        }
    } catch (e) {
        console.error('Error loading project:', e);
        showToast('Erreur lors du chargement', 'error');
    }
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'À l\'instant';
    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)} h`;
    if (diff < 604800000) return `Il y a ${Math.floor(diff / 86400000)} j`;

    return date.toLocaleDateString('fr-FR');
}

// Auto-save to recent projects on save
function autoSaveToRecent() {
    if (state.objects.length > 0) {
        const name = document.getElementById('file-name').value || 'Sans titre';
        saveToRecentProjects(name, state.objects);
    }
}

// Initialize home modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initHomeModal();
});

// Show home modal when clicking logo
document.querySelector('.logo')?.addEventListener('click', () => {
    loadRecentProjects();
    document.getElementById('home-modal').classList.remove('hidden');
});

// ========================================
// CODE EXPORT
// ========================================

let currentCodeTab = 'html-css';

function initCodeExportModal() {
    // Export code menu click
    document.getElementById('export-code')?.addEventListener('click', (e) => {
        e.preventDefault();
        openCodeExportModal();
    });

    // Close modal
    document.getElementById('close-code-export')?.addEventListener('click', () => {
        document.getElementById('code-export-modal').classList.add('hidden');
    });

    // Close on overlay click
    document.getElementById('code-export-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'code-export-modal') {
            document.getElementById('code-export-modal').classList.add('hidden');
        }
    });

    // Tab switching
    document.querySelectorAll('.code-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.code-tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const tabId = tab.dataset.tab + '-tab';
            document.getElementById(tabId).classList.add('active');
            currentCodeTab = tab.dataset.tab;
        });
    });

    // Copy code
    document.getElementById('copy-code')?.addEventListener('click', () => {
        const codeElement = currentCodeTab === 'html-css'
            ? document.getElementById('html-css-code')
            : document.getElementById('jsx-code');

        const code = codeElement.textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast('Code copié dans le presse-papiers!', 'success');
        }).catch(() => {
            showToast('Erreur lors de la copie', 'error');
        });
    });

    // Download code
    document.getElementById('download-code')?.addEventListener('click', () => {
        const codeElement = currentCodeTab === 'html-css'
            ? document.getElementById('html-css-code')
            : document.getElementById('jsx-code');

        const code = codeElement.textContent;
        const extension = currentCodeTab === 'html-css' ? 'html' : 'jsx';
        const filename = `designeme-export.${extension}`;

        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        showToast(`Fichier ${filename} téléchargé!`, 'success');
    });
}

function openCodeExportModal() {
    const modal = document.getElementById('code-export-modal');
    modal.classList.remove('hidden');

    // Generate code for both tabs
    generateHTMLCSS();
    generateJSX();
}

function generateHTMLCSS() {
    const objects = state.objects;
    let html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DesigneMe Export</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: #f5f5f5;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .canvas-container {
            position: relative;
            background-color: #ffffff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
${generateCSSStyles(objects)}
    </style>
</head>
<body>
    <div class="canvas-container">
${generateHTMLElements(objects)}
    </div>
</body>
</html>`;

    document.getElementById('html-css-code').textContent = html;
}

function generateCSSStyles(objects) {
    let css = '';

    objects.forEach((obj, index) => {
        const className = sanitizeClassName(obj.name || `element-${index}`);

        // Skip path/vector/line types - they use inline SVG styles
        if (obj.type === 'path' || obj.type === 'vector' || obj.type === 'line') {
            return; // SVG elements have inline styles
        }

        let style = `        .${className} {\n`;
        style += `            position: absolute;\n`;
        style += `            left: ${Math.round(obj.x)}px;\n`;
        style += `            top: ${Math.round(obj.y)}px;\n`;

        if (obj.width) style += `            width: ${Math.round(obj.width)}px;\n`;
        if (obj.height) style += `            height: ${Math.round(obj.height)}px;\n`;

        // Background color
        if (obj.fill && obj.fill !== 'transparent') {
            style += `            background-color: ${obj.fill};\n`;
        }

        // Border
        if (obj.strokeWidth > 0 && obj.stroke) {
            style += `            border: ${obj.strokeWidth}px solid ${obj.stroke};\n`;
        }

        // Border radius
        if (obj.cornerRadius > 0) {
            style += `            border-radius: ${obj.cornerRadius}px;\n`;
        } else if (obj.type === 'ellipse') {
            style += `            border-radius: 50%;\n`;
        }

        // Opacity
        if (obj.opacity < 100) {
            style += `            opacity: ${obj.opacity / 100};\n`;
        }

        // Rotation
        if (obj.rotation !== 0) {
            style += `            transform: rotate(${obj.rotation}deg);\n`;
        }

        // Text styles
        if (obj.type === 'text') {
            style += `            font-size: ${obj.fontSize || 16}px;\n`;
            style += `            font-family: ${obj.fontFamily || 'Inter, sans-serif'};\n`;
            if (obj.fontWeight) style += `            font-weight: ${obj.fontWeight};\n`;
            style += `            color: ${obj.fill || '#000000'};\n`;
            if (obj.textAlign) style += `            text-align: ${obj.textAlign};\n`;
        }

        // Shadow
        if (obj.shadow) {
            const s = obj.shadow;
            const alpha = (s.opacity || 40) / 100;
            style += `            box-shadow: ${s.x || 0}px ${s.y || 0}px ${s.blur || 0}px rgba(0,0,0,${alpha});\n`;
        }

        style += `        }\n`;
        css += style;
    });

    return css;
}

function generateHTMLElements(objects) {
    let html = '';

    objects.forEach((obj, index) => {
        const className = sanitizeClassName(obj.name || `element-${index}`);
        let indent = '        ';

        switch (obj.type) {
            case 'text':
                html += `${indent}<p class="${className}">${escapeHTML(obj.text || '')}</p>\n`;
                break;

            case 'image':
                html += `${indent}<img class="${className}" src="${obj.src || ''}" alt="${obj.name || 'image'}">\n`;
                break;

            case 'frame':
                html += `${indent}<div class="${className}" data-type="frame"></div>\n`;
                break;

            case 'line':
                // Export line as SVG
                html += generateLineSVG(obj, className, indent);
                break;

            case 'path':
                // Export pencil path as SVG
                html += generatePathSVG(obj, className, indent);
                break;

            case 'vector':
                // Export pen vector as SVG
                html += generateVectorSVG(obj, className, indent);
                break;

            case 'ellipse':
                // Ellipse uses div with border-radius in CSS
                html += `${indent}<div class="${className}"></div>\n`;
                break;

            default:
                html += `${indent}<div class="${className}"></div>\n`;
                break;
        }
    });

    return html;
}

// Generate SVG for line elements
function generateLineSVG(obj, className, indent) {
    const stroke = obj.stroke || '#000000';
    const strokeWidth = obj.strokeWidth || 2;
    const padding = strokeWidth;

    // Calculate line dimensions
    const width = Math.max(Math.abs(obj.width), 1) + padding * 2;
    const height = Math.max(Math.abs(obj.height), 1) + padding * 2;

    // Line endpoints relative to SVG
    const x1 = padding;
    const y1 = padding;
    const x2 = Math.abs(obj.width) + padding;
    const y2 = Math.abs(obj.height) + padding;

    return `${indent}<svg class="${className}" width="${width}" height="${height}" style="position:absolute;left:${Math.round(obj.x)}px;top:${Math.round(obj.y)}px;overflow:visible;">
${indent}    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
${indent}</svg>\n`;
}

// Generate SVG for pencil path elements
function generatePathSVG(obj, className, indent) {
    if (!obj.points || obj.points.length < 2) {
        return `${indent}<!-- Path ${className} sans points -->\n`;
    }

    const stroke = obj.stroke || '#000000';
    const strokeWidth = obj.strokeWidth || 2;
    const fill = obj.fill && obj.fill !== 'transparent' ? obj.fill : 'none';

    // Calculate bounding box of points
    const bounds = calculatePointsBounds(obj.points);
    const padding = strokeWidth * 2;
    const width = Math.max(bounds.width + padding * 2, 10);
    const height = Math.max(bounds.height + padding * 2, 10);

    // Translate points relative to SVG origin
    const offsetX = bounds.minX - padding;
    const offsetY = bounds.minY - padding;
    const pathD = pointsToSVGPath(obj.points, offsetX, offsetY);

    return `${indent}<svg class="${className}" width="${width}" height="${height}" style="position:absolute;left:${Math.round(bounds.minX - padding)}px;top:${Math.round(bounds.minY - padding)}px;overflow:visible;">
${indent}    <path d="${pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
${indent}</svg>\n`;
}

// Generate SVG for pen vector elements
function generateVectorSVG(obj, className, indent) {
    if (!obj.points || obj.points.length < 2) {
        return `${indent}<!-- Vector ${className} sans points -->\n`;
    }

    const stroke = obj.stroke || '#000000';
    const strokeWidth = obj.strokeWidth || 2;
    const fill = obj.fill && obj.fill !== 'transparent' ? obj.fill : 'none';

    // Calculate bounding box
    const bounds = calculatePointsBounds(obj.points);
    const padding = strokeWidth * 2;
    const width = Math.max(bounds.width + padding * 2, 10);
    const height = Math.max(bounds.height + padding * 2, 10);

    // Translate points relative to SVG origin
    const offsetX = bounds.minX - padding;
    const offsetY = bounds.minY - padding;
    const pathD = pointsToSVGPath(obj.points, offsetX, offsetY, obj.closed);

    return `${indent}<svg class="${className}" width="${width}" height="${height}" style="position:absolute;left:${Math.round(bounds.minX - padding)}px;top:${Math.round(bounds.minY - padding)}px;overflow:visible;">
${indent}    <path d="${pathD}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
${indent}</svg>\n`;
}

// Convert points array to SVG path data string
function pointsToSVGPath(points, offsetX, offsetY, closed) {
    if (!points || points.length === 0) return '';

    offsetX = offsetX || 0;
    offsetY = offsetY || 0;

    let d = 'M ' + (points[0].x - offsetX).toFixed(1) + ' ' + (points[0].y - offsetY).toFixed(1);

    for (let i = 1; i < points.length; i++) {
        var p = points[i];
        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
            d += ' L ' + (p.x - offsetX).toFixed(1) + ' ' + (p.y - offsetY).toFixed(1);
        }
    }

    if (closed) {
        d += ' Z';
    }

    return d;
}

// Calculate bounding box of points
function calculatePointsBounds(points) {
    if (!points || points.length === 0) {
        return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        }
    }

    return {
        minX: minX,
        minY: minY,
        maxX: maxX,
        maxY: maxY,
        width: maxX - minX,
        height: maxY - minY
    };
}

function generateJSX() {
    const objects = state.objects;
    let jsx = `import React from 'react';

function DesigneMeExport() {
    return (
        <div style={styles.container}>
${generateJSXElements(objects)}
        </div>
    );
}

const styles = {
    container: {
        position: 'relative',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    },
${generateJSXStyles(objects)}
};

export default DesigneMeExport;`;

    document.getElementById('jsx-code').textContent = jsx;
}

function generateJSXStyles(objects) {
    let styles = '';

    objects.forEach((obj, index) => {
        const styleName = camelCase(obj.name || `element${index}`);

        // Skip path/vector/line types - they use inline styles in SVG
        if (obj.type === 'path' || obj.type === 'vector' || obj.type === 'line') {
            return;
        }

        let style = `    ${styleName}: {\n`;
        style += `        position: 'absolute',\n`;
        style += `        left: ${Math.round(obj.x)},\n`;
        style += `        top: ${Math.round(obj.y)},\n`;

        if (obj.width) style += `        width: ${Math.round(obj.width)},\n`;
        if (obj.height) style += `        height: ${Math.round(obj.height)},\n`;

        if (obj.fill && obj.fill !== 'transparent') {
            style += `        backgroundColor: '${obj.fill}',\n`;
        }

        if (obj.strokeWidth > 0 && obj.stroke) {
            style += `        border: '${obj.strokeWidth}px solid ${obj.stroke}',\n`;
        }

        if (obj.cornerRadius > 0) {
            style += `        borderRadius: ${obj.cornerRadius},\n`;
        } else if (obj.type === 'ellipse') {
            style += `        borderRadius: '50%',\n`;
        }

        if (obj.opacity < 100) {
            style += `        opacity: ${obj.opacity / 100},\n`;
        }

        if (obj.rotation !== 0) {
            style += `        transform: 'rotate(${obj.rotation}deg)',\n`;
        }

        if (obj.type === 'text') {
            style += `        fontSize: ${obj.fontSize || 16},\n`;
            style += `        fontFamily: '${obj.fontFamily || 'Inter, sans-serif'}',\n`;
            if (obj.fontWeight) style += `        fontWeight: ${obj.fontWeight},\n`;
            style += `        color: '${obj.fill || '#000000'}',\n`;
        }

        if (obj.shadow) {
            const s = obj.shadow;
            const alpha = (s.opacity || 40) / 100;
            style += `        boxShadow: '${s.x || 0}px ${s.y || 0}px ${s.blur || 0}px rgba(0,0,0,${alpha})',\n`;
        }

        style += `    },\n`;
        styles += style;
    });

    return styles;
}

function generateJSXElements(objects) {
    let jsx = '';

    objects.forEach((obj, index) => {
        const styleName = camelCase(obj.name || `element${index}`);
        let indent = '            ';

        switch (obj.type) {
            case 'text':
                jsx += `${indent}<p style={styles.${styleName}}>${escapeHTML(obj.text || '')}</p>\n`;
                break;

            case 'image':
                jsx += `${indent}<img style={styles.${styleName}} src="${obj.src || ''}" alt="${obj.name || 'image'}" />\n`;
                break;

            case 'line':
                jsx += generateLineJSX(obj, indent);
                break;

            case 'path':
                jsx += generatePathJSX(obj, indent);
                break;

            case 'vector':
                jsx += generateVectorJSX(obj, indent);
                break;

            case 'ellipse':
                jsx += `${indent}<div style={styles.${styleName}} />\n`;
                break;

            default:
                jsx += `${indent}<div style={styles.${styleName}} />\n`;
                break;
        }
    });

    return jsx;
}

// Generate JSX SVG for line elements
function generateLineJSX(obj, indent) {
    const stroke = obj.stroke || '#000000';
    const strokeWidth = obj.strokeWidth || 2;
    const padding = strokeWidth;
    const width = Math.max(Math.abs(obj.width), 1) + padding * 2;
    const height = Math.max(Math.abs(obj.height), 1) + padding * 2;

    return `${indent}<svg width={${width}} height={${height}} style={{position: 'absolute', left: ${Math.round(obj.x)}, top: ${Math.round(obj.y)}, overflow: 'visible'}}>
${indent}    <line x1={${padding}} y1={${padding}} x2={${Math.abs(obj.width) + padding}} y2={${Math.abs(obj.height) + padding}} stroke="${stroke}" strokeWidth={${strokeWidth}} strokeLinecap="round" />
${indent}</svg>\n`;
}

// Generate JSX SVG for path elements
function generatePathJSX(obj, indent) {
    if (!obj.points || obj.points.length < 2) {
        return `${indent}{/* Path sans points */}\n`;
    }

    const stroke = obj.stroke || '#000000';
    const strokeWidth = obj.strokeWidth || 2;
    const fill = obj.fill && obj.fill !== 'transparent' ? obj.fill : 'none';

    const bounds = calculatePointsBounds(obj.points);
    const padding = strokeWidth * 2;
    const width = Math.max(bounds.width + padding * 2, 10);
    const height = Math.max(bounds.height + padding * 2, 10);

    const offsetX = bounds.minX - padding;
    const offsetY = bounds.minY - padding;
    const pathD = pointsToSVGPath(obj.points, offsetX, offsetY);

    return `${indent}<svg width={${width}} height={${height}} style={{position: 'absolute', left: ${Math.round(bounds.minX - padding)}, top: ${Math.round(bounds.minY - padding)}, overflow: 'visible'}}>
${indent}    <path d="${pathD}" fill="${fill}" stroke="${stroke}" strokeWidth={${strokeWidth}} strokeLinecap="round" strokeLinejoin="round" />
${indent}</svg>\n`;
}

// Generate JSX SVG for vector elements
function generateVectorJSX(obj, indent) {
    if (!obj.points || obj.points.length < 2) {
        return `${indent}{/* Vector sans points */}\n`;
    }

    const stroke = obj.stroke || '#000000';
    const strokeWidth = obj.strokeWidth || 2;
    const fill = obj.fill && obj.fill !== 'transparent' ? obj.fill : 'none';

    const bounds = calculatePointsBounds(obj.points);
    const padding = strokeWidth * 2;
    const width = Math.max(bounds.width + padding * 2, 10);
    const height = Math.max(bounds.height + padding * 2, 10);

    const offsetX = bounds.minX - padding;
    const offsetY = bounds.minY - padding;
    const pathD = pointsToSVGPath(obj.points, offsetX, offsetY, obj.closed);

    return `${indent}<svg width={${width}} height={${height}} style={{position: 'absolute', left: ${Math.round(bounds.minX - padding)}, top: ${Math.round(bounds.minY - padding)}, overflow: 'visible'}}>
${indent}    <path d="${pathD}" fill="${fill}" stroke="${stroke}" strokeWidth={${strokeWidth}} strokeLinecap="round" strokeLinejoin="round" />
${indent}</svg>\n`;
}

// Helper functions for code generation
function sanitizeClassName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/^(\d)/, 'el-$1') || 'element';
}

function camelCase(str) {
    return str
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
        .replace(/^[A-Z]/, chr => chr.toLowerCase())
        .replace(/^(\d)/, 'el$1') || 'element';
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Initialize code export modal when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initCodeExportModal();
});
