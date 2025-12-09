/**
 * FIGMA CLONE - Main Application
 * A web-based design tool similar to Figma
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

    // Default styles
    defaultFill: '#5E5CE6',
    defaultStroke: '#000000',
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

    showToast('Bienvenue dans Figma Clone!', 'success');
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

    // Context menu
    canvas.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', hideContextMenu);

    // Prevent default drag
    canvas.addEventListener('dragstart', (e) => e.preventDefault());
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
                handleShapeToolDown(point);
                break;
            case 'text':
                handleTextToolDown(point);
                break;
            case 'pencil':
                handlePencilToolDown(point);
                break;
            default:
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

    // Drawing shapes
    if (state.isDrawing && state.tempObject) {
        updateTempObject(point);
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

    // Pencil drawing
    if (state.currentTool === 'pencil' && state.isDrawing && state.tempObject) {
        state.tempObject.points.push(point);
        render();
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
        finalizeObject();
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
        fill: state.defaultFill,
        stroke: state.defaultStroke,
        strokeWidth: state.defaultStrokeWidth,
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
    const textObj = {
        id: generateId(),
        type: 'text',
        x: point.x,
        y: point.y,
        width: 200,
        height: 30,
        text: 'Texte',
        fontSize: 16,
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

    // Start editing immediately
    startTextEditing(textObj);
}

function handlePencilToolDown(point) {
    state.isDrawing = true;
    state.tempObject = {
        id: generateId(),
        type: 'path',
        points: [point],
        stroke: state.defaultStroke,
        strokeWidth: 2,
        fill: 'transparent',
        opacity: state.defaultOpacity,
        name: getObjectName('path')
    };
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
        return {
            x: obj.x,
            y: obj.y - obj.fontSize,
            width: metrics.width,
            height: obj.fontSize * 1.2
        };
    }

    return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
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

    const bounds = getObjectBounds(obj);
    const screenPos = canvasToScreen({ x: bounds.x, y: bounds.y + obj.fontSize });

    const textarea = document.createElement('textarea');
    textarea.className = 'text-input-overlay';
    textarea.value = obj.text;
    textarea.style.left = screenPos.x + 'px';
    textarea.style.top = screenPos.y + 'px';
    textarea.style.fontSize = (obj.fontSize * state.zoom) + 'px';
    textarea.style.fontFamily = obj.fontFamily;
    textarea.style.color = obj.fill;
    textarea.style.width = (bounds.width * state.zoom + 20) + 'px';
    textarea.style.height = (bounds.height * state.zoom + 20) + 'px';

    textarea.addEventListener('blur', () => {
        finishTextEditing(textarea);
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            finishTextEditing(textarea);
        }
    });

    state.canvasWrapper.appendChild(textarea);
    textarea.focus();
    textarea.select();
}

function finishTextEditing(textarea) {
    if (state.editingTextObject) {
        state.editingTextObject.text = textarea.value;
        saveHistory();
    }

    state.isEditingText = false;
    state.editingTextObject = null;
    textarea.remove();
    render();
}

// ========================================
// RENDERING
// ========================================

function render() {
    const ctx = state.ctx;
    const canvas = state.canvas;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
}

function drawObject(ctx, obj) {
    ctx.save();
    ctx.globalAlpha = obj.opacity / 100;

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
            const tool = btn.dataset.tool;
            selectTool(tool);
        });
    });
}

function selectTool(tool) {
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

    // Properties panel inputs
    initPropertiesPanel();

    // Context menu actions
    initContextMenu();

    // Color picker
    initColorPicker();
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
}

function updateLayersPanel() {
    const tree = document.getElementById('layers-tree');
    const pageItem = tree.querySelector('.layer-item.page');

    // Remove all layer items except the page
    tree.querySelectorAll('.layer-item:not(.page)').forEach(el => el.remove());

    // Add layer items for each object (in reverse order)
    [...state.objects].reverse().forEach(obj => {
        const item = document.createElement('div');
        item.className = 'layer-item';
        if (state.selectedObjects.includes(obj)) {
            item.classList.add('selected');
        }
        item.dataset.id = obj.id;

        const icon = getIconForType(obj.type);
        item.innerHTML = `
            <span class="layer-icon">${icon}</span>
            <span class="layer-name">${obj.name}</span>
            <span class="layer-visibility">👁</span>
        `;

        item.addEventListener('click', (e) => {
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

        tree.appendChild(item);
    });
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
        frame: '📱'
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

function initColorPicker() {
    const modal = document.getElementById('color-picker-modal');
    const gradient = document.getElementById('color-gradient');
    const hue = document.getElementById('color-hue');
    const closeBtn = modal.querySelector('.close-modal');

    closeBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
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

    // Input changes
    document.getElementById('hex-input').addEventListener('change', (e) => {
        applyColorFromPicker(e.target.value);
    });
}

function openColorPicker(target) {
    currentColorTarget = target;
    document.getElementById('color-picker-modal').classList.remove('hidden');
}

function updateGradientColor(e) {
    const gradient = document.getElementById('color-gradient');
    const rect = gradient.getBoundingClientRect();
    const cursor = document.getElementById('color-cursor');

    let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    let y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';

    // Calculate color (simplified)
    const saturation = x / rect.width;
    const brightness = 1 - y / rect.height;
    const color = hsbToHex(currentHue || 0, saturation, brightness);

    applyColorFromPicker(color);
}

let currentHue = 0;

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
}

function applyColorFromPicker(color) {
    document.getElementById('hex-input').value = color;

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
                state.selectedObjects = [];
                updatePropertiesPanel();
                updateLayersPanel();
                render();
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

document.getElementById('save-file')?.addEventListener('click', () => {
    const data = JSON.stringify({
        objects: state.objects,
        version: '1.0'
    });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = document.getElementById('file-name').value + '.figclone';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Fichier sauvegardé!', 'success');
});

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

// Initialize history
saveHistory();
