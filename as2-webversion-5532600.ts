abstract class Shape {
    abstract getArea(): number;
    abstract getPerimeter(): number;
    abstract getName(): string;

    // Draws the shape centered at (centerX, centerY), scaled to fit
    // within a maxSize x maxSize box.  Fill/stroke style is whatever the
    // caller has already set on ctx -- draw() only handles geometry.
    abstract draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, maxSize: number): void;
}

abstract class Polygon extends Shape {
    abstract getLongestSegmentLength(): number;
    abstract getShortestSegmentLength(): number;
}

class Rectangle extends Polygon {
    getArea(): number {
        return this.#length * this.#width;
    }

    getPerimeter(): number {
        return 2 * (this.#length + this.#width);
    }

    getLongestSegmentLength(): number {
        return (this.#length > this.#width) ? this.#length : this.#width;
    }

    getShortestSegmentLength(): number {
        return (this.#length < this.#width) ? this.#length : this.#width;
    }

    getName(): string {
        return "Rectangle";
    }

    draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, maxSize: number): void {
        const scale = maxSize / Math.max(this.#length, this.#width);
        const w = this.#length * scale;
        const h = this.#width * scale;

        ctx.beginPath();
        ctx.rect(centerX - w / 2, centerY - h / 2, w, h);
        ctx.fill();
        ctx.stroke();
    }

    constructor(length: number, width: number) {
        super();

        this.#length = length;
        this.#width = width;
    }

    #length: number;
    #width: number;
}

class Square extends Rectangle {
    getName(): string {
        return "Square";
    }

    constructor(side: number) {
        super(side, side);
    }
}

class Triangle extends Polygon {
    // Heron's formula: area from the three side lengths alone.
    getArea(): number {
        const s = (this.#a + this.#b + this.#c) / 2;
        return Math.sqrt(s * (s - this.#a) * (s - this.#b) * (s - this.#c));
    }

    getPerimeter(): number {
        return this.#a + this.#b + this.#c;
    }

    getLongestSegmentLength(): number {
        return Math.max(this.#a, this.#b, this.#c);
    }

    getShortestSegmentLength(): number {
        return Math.min(this.#a, this.#b, this.#c);
    }

    getName(): string {
        return "Triangle";
    }

    /* Places vertex1 at the origin, vertex2 at distance c along the
       x-axis, and solves for vertex3 with the law of cosines using the
       angle at vertex1 between sides b and c.  The resulting triangle is
       then scaled and centered to fit the requested box. */
    draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, maxSize: number): void {
        const angleAtVertex1 = Math.acos(
            (this.#b * this.#b + this.#c * this.#c - this.#a * this.#a) / (2 * this.#b * this.#c)
        );

        const vertices = [
            { x: 0, y: 0 },
            { x: this.#c, y: 0 },
            { x: this.#b * Math.cos(angleAtVertex1), y: this.#b * Math.sin(angleAtVertex1) },
        ];

        const minX = Math.min(vertices[0].x, vertices[1].x, vertices[2].x);
        const maxX = Math.max(vertices[0].x, vertices[1].x, vertices[2].x);
        const minY = Math.min(vertices[0].y, vertices[1].y, vertices[2].y);
        const maxY = Math.max(vertices[0].y, vertices[1].y, vertices[2].y);

        const scale = maxSize / Math.max(maxX - minX, maxY - minY);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const toCanvasX = (x: number) => centerX + (x - midX) * scale;
        const toCanvasY = (y: number) => centerY + (y - midY) * scale;

        ctx.beginPath();
        ctx.moveTo(toCanvasX(vertices[0].x), toCanvasY(vertices[0].y));
        ctx.lineTo(toCanvasX(vertices[1].x), toCanvasY(vertices[1].y));
        ctx.lineTo(toCanvasX(vertices[2].x), toCanvasY(vertices[2].y));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    constructor(a: number, b: number, c: number) {
        super();

        this.#a = a;
        this.#b = b;
        this.#c = c;
    }

    #a: number;
    #b: number;
    #c: number;
}

class Oval extends Shape {
    getArea(): number {
        return Math.PI * this.#semiMajorAxis * this.#semiMinorAxis;
    }

    // Ramanujan's approximation for the circumference of an ellipse.
    // Reduces exactly to 2*PI*r when both axes match, so Circle can
    // reuse it unchanged.
    getPerimeter(): number {
        const a = this.#semiMajorAxis;
        const b = this.#semiMinorAxis;
        return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    }

    getName(): string {
        return "Oval";
    }

    draw(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, maxSize: number): void {
        const scale = (maxSize / 2) / Math.max(this.#semiMajorAxis, this.#semiMinorAxis);
        const rx = this.#semiMajorAxis * scale;
        const ry = this.#semiMinorAxis * scale;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }

    constructor(semiMajorAxis: number, semiMinorAxis: number) {
        super();

        this.#semiMajorAxis = semiMajorAxis;
        this.#semiMinorAxis = semiMinorAxis;
    }

    #semiMajorAxis: number;
    #semiMinorAxis: number;
}

class Circle extends Oval {
    getName(): string {
        return "Circle";
    }

    constructor(radius: number) {
        super(radius, radius);
    }
}

// Thrown when a form field can't be turned into a usable shape
// parameter, so the Add button's handler can show the problem instead
// of constructing a bad shape.
class ValidationError extends Error {
}

/* Reads one <input> element's value and parses it as a positive number.
   Accepts: the input element and a human-readable label for messages.
   Returns: the parsed value.
   Can go wrong: throws ValidationError if the field is blank,
   non-numeric, or not greater than 0. */
function readPositiveNumberField(input: HTMLInputElement, fieldLabel: string): number {
    const raw = input.value;
    const value = Number(raw);

    if (raw.trim() === "" || Number.isNaN(value)) {
        throw new ValidationError(`${fieldLabel} must be a number.`);
    }

    if (value <= 0) {
        throw new ValidationError(`${fieldLabel} must be greater than 0.`);
    }

    return value;
}

function getInput(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
}

/* Reads the currently-selected shape type and its matching fields out
   of the DOM, validates them, and builds the corresponding Shape.
   Accepts: nothing; reads directly from the form elements on the page.
   Returns: the new Shape.
   Can go wrong: throws ValidationError if any required field is blank,
   non-numeric, non-positive, or (for a triangle) can't form a triangle. */
function buildShapeFromForm(): Shape {
    const shapeType = (document.getElementById("shapeType") as HTMLSelectElement).value;

    switch (shapeType) {
        case "rectangle": {
            const width = readPositiveNumberField(getInput("rectangleWidth"), "Width");
            const height = readPositiveNumberField(getInput("rectangleHeight"), "Height");
            return new Rectangle(width, height);
        }
        case "square": {
            const side = readPositiveNumberField(getInput("squareSide"), "Side length");
            return new Square(side);
        }
        case "triangle": {
            const a = readPositiveNumberField(getInput("triangleA"), "Side a");
            const b = readPositiveNumberField(getInput("triangleB"), "Side b");
            const c = readPositiveNumberField(getInput("triangleC"), "Side c");

            if (!(a + b > c && a + c > b && b + c > a)) {
                throw new ValidationError("Those side lengths can't form a triangle.");
            }

            return new Triangle(a, b, c);
        }
        case "oval": {
            const semiMajorAxis = readPositiveNumberField(getInput("ovalSemiMajor"), "Semi-major axis");
            const semiMinorAxis = readPositiveNumberField(getInput("ovalSemiMinor"), "Semi-minor axis");
            return new Oval(semiMajorAxis, semiMinorAxis);
        }
        case "circle": {
            const radius = readPositiveNumberField(getInput("circleRadius"), "Radius");
            return new Circle(radius);
        }
        default:
            throw new ValidationError("Unknown shape type.");
    }
}

/* Builds an HTML summary table (one row per shape, plus totals) and
   writes it into container. */
function renderStatistics(shapes: Set<Shape>, container: HTMLElement): void {
    let totalArea = 0;
    let totalPerimeter = 0;

    let html = "<h2>Final Statistics</h2>";
    html += "<table border=\"1\" cellpadding=\"4\">";
    html += "<tr><th>Shape</th><th>Area</th><th>Perimeter</th></tr>";

    for (const shape of shapes) {
        // Polymorphic calls only -- no type checks, no casts.
        const area = shape.getArea();
        const perimeter = shape.getPerimeter();

        totalArea += area;
        totalPerimeter += perimeter;

        html += "<tr>";
        html += `<td>${shape.getName()}</td>`;
        html += `<td>${area.toFixed(2)}</td>`;
        html += `<td>${perimeter.toFixed(2)}</td>`;
        html += "</tr>";
    }

    html += "</table>";
    html += `<p>Shapes entered: ${shapes.size}</p>`;
    html += `<p>Total area: ${totalArea.toFixed(2)}</p>`;
    html += `<p>Total perimeter: ${totalPerimeter.toFixed(2)}</p>`;
    html += `<p>Sum of perimeter and area of every shape: ${(totalArea + totalPerimeter).toFixed(2)}</p>`;

    container.innerHTML = html;
}

const SHAPE_COLORS = ["#4C78A8", "#F58518", "#54A24B", "#E45756", "#72B7B2", "#EECA3B"];

/* Lays every shape out in a row across the canvas and draws it,
   cycling through a small palette so adjacent shapes stay visually
   distinct, and labels each one with its name. */
function drawAllShapes(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, shapes: Set<Shape>): void {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const n = shapes.size;

    if (n === 0) {
        return;
    }

    const slotWidth = canvasWidth / n;
    const maxSize = Math.min(slotWidth, canvasHeight) * 0.6;
    const centerY = canvasHeight / 2 - 10;

    let i = 0;

    for (const shape of shapes) {
        const centerX = slotWidth * i + slotWidth / 2;
        const color = SHAPE_COLORS[i % SHAPE_COLORS.length];

        ctx.fillStyle = color + "80";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        shape.draw(ctx, centerX, centerY, maxSize);

        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.fillText(shape.getName(), centerX, centerY + maxSize / 2 + 20);

        i++;
    }
}

// Which field group goes with each <option value="..."> in #shapeType.
const FIELD_GROUPS: Record<string, HTMLElement> = {
    rectangle: document.getElementById("rectangleFields") as HTMLElement,
    square: document.getElementById("squareFields") as HTMLElement,
    triangle: document.getElementById("triangleFields") as HTMLElement,
    oval: document.getElementById("ovalFields") as HTMLElement,
    circle: document.getElementById("circleFields") as HTMLElement,
};

const shapeTypeSelect = document.getElementById("shapeType") as HTMLSelectElement;
const addShapeButton = document.getElementById("addShapeButton") as HTMLButtonElement;
const finishButton = document.getElementById("finishButton") as HTMLButtonElement;
const statusMessage = document.getElementById("statusMessage") as HTMLElement;
const outputElement = document.getElementById("scriptScratchpad") as HTMLElement;
const canvas = document.getElementById("scriptCanvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

const shapes = new Set<Shape>();

// Shows only the field group that matches the currently-selected shape
// type; this is the "change" trigger on the dropdown.
function updateVisibleFields(): void {
    for (const key in FIELD_GROUPS) {
        FIELD_GROUPS[key].hidden = (key !== shapeTypeSelect.value);
    }
}

shapeTypeSelect.addEventListener("change", updateVisibleFields);
updateVisibleFields();

// The "Add shape" trigger: read the form, validate, and add the result
// to the backing Set -- or report what's wrong without adding anything.
addShapeButton.addEventListener("click", () => {
    try {
        const shape = buildShapeFromForm();
        shapes.add(shape);
        statusMessage.textContent = `Added a ${shape.getName()}. (${shapes.size} shape(s) so far)`;
    } catch (error) {
        if (error instanceof ValidationError) {
            statusMessage.textContent = error.message;
        } else {
            throw error;
        }
    }
});

// The "Finish" trigger: render the stats table and draw everything
// collected so far onto the canvas.
finishButton.addEventListener("click", () => {
    renderStatistics(shapes, outputElement);
    drawAllShapes(ctx, canvas.width, canvas.height, shapes);
});
