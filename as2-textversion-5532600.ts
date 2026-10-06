import { createInterface, Interface } from "node:readline";
import { stdin, stdout } from "node:process";

abstract class Shape {
  abstract getArea(): number;
  abstract getPerimeter(): number;
  abstract getName(): string;
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
    return this.#length > this.#width ? this.#length : this.#width;
  }

  getShortestSegmentLength(): number {
    return this.#length < this.#width ? this.#length : this.#width;
  }

  getName(): string {
    return "Rectangle";
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

// Thrown when the input stream runs out (EOF) while a value is still
// being requested, so the menu loop doesn't spin forever re-prompting a
// stream that can never supply more data.
class InputExhausted extends Error {}

/* Wraps a readline Interface's async line iterator so prompts can be
   awaited one at a time without dropping lines.  Plain rl.question()
   calls lose data on piped (non-TTY) input, because lines that arrive
   between questions have nowhere to go; pulling from the interface's
   own async iterator queues every line in order instead. */
class LineReader {
  constructor(rl: Interface) {
    this.#iterator = rl[Symbol.asyncIterator]();
  }

  /* Reads the next line of input.
       Returns: the line, or null if the stream has reached EOF.
       Can go wrong: nothing throws here; EOF is reported as null so
       callers can decide how to react. */
  async readLine(): Promise<string | null> {
    const { value, done } = await this.#iterator.next();
    return done ? null : value;
  }

  #iterator: AsyncIterator<string>;
}

/* Prints prompt, reads one line, and parses it as a number, re-prompting
   on non-numeric input.
   Accepts: the LineReader to read from and the prompt to show.
   Returns: a promise for the number the user entered.
   Can go wrong: throws InputExhausted if the stream hits EOF before a
   valid number is entered. */
async function readNumber(reader: LineReader, prompt: string): Promise<number> {
  while (true) {
    stdout.write(prompt);
    const line = await reader.readLine();

    if (line === null) {
      throw new InputExhausted();
    }

    const value = Number(line);

    if (!Number.isNaN(value) && line.trim() !== "") {
      return value;
    }

    console.log("Invalid input. Please enter a number.");
  }
}

async function readPositiveNumber(
  reader: LineReader,
  prompt: string,
): Promise<number> {
  while (true) {
    const value = await readNumber(reader, prompt);

    if (value > 0) {
      return value;
    }

    console.log("Please enter a value greater than 0.");
  }
}

async function readIntInRange(
  reader: LineReader,
  prompt: string,
  lo: number,
  hi: number,
): Promise<number> {
  while (true) {
    const value = await readNumber(reader, prompt);

    if (Number.isInteger(value) && value >= lo && value <= hi) {
      return value;
    }

    console.log(
      `Invalid choice. Please enter a whole number between ${lo} and ${hi}.`,
    );
  }
}

async function readTriangle(reader: LineReader): Promise<Triangle> {
  while (true) {
    const a = await readPositiveNumber(reader, "Enter side a: ");
    const b = await readPositiveNumber(reader, "Enter side b: ");
    const c = await readPositiveNumber(reader, "Enter side c: ");

    if (a + b > c && a + c > b && b + c > a) {
      return new Triangle(a, b, c);
    }

    console.log("Those side lengths can't form a triangle. Try again.");
  }
}

function printMenu(): void {
  console.log("\n===== Shape Summarizer =====");
  console.log("1. Add Rectangle");
  console.log("2. Add Square");
  console.log("3. Add Triangle");
  console.log("4. Add Oval");
  console.log("5. Add Circle");
  console.log("6. Finish and show statistics");
}

/* Walks every shape collected so far and totals up area and perimeter.
   Accepts: the collection of shapes entered by the user.
   Returns: nothing; prints the per-shape breakdown and the grand totals.
   Can go wrong: nothing -- an empty collection just prints zero totals. */
function printStatistics(shapes: Set<Shape>): void {
  let totalArea = 0;
  let totalPerimeter = 0;

  console.log("\n===== Final Statistics =====");

  for (const shape of shapes) {
    // Polymorphic calls only -- no type checks, no casts.
    const area = shape.getArea();
    const perimeter = shape.getPerimeter();

    totalArea += area;
    totalPerimeter += perimeter;

    console.log(
      `${shape.getName()}: area = ${area.toFixed(2)}, perimeter = ${perimeter.toFixed(2)}`,
    );
  }

  console.log(`\nShapes entered: ${shapes.size}`);
  console.log(`Total area: ${totalArea.toFixed(2)}`);
  console.log(`Total perimeter: ${totalPerimeter.toFixed(2)}`);
  console.log(
    `Sum of perimeter and area of every shape: ${(totalArea + totalPerimeter).toFixed(2)}`,
  );
}

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: false });
  const reader = new LineReader(rl);
  const shapes = new Set<Shape>();

  try {
    let done = false;

    while (!done) {
      printMenu();
      const choice = await readIntInRange(reader, "Enter your choice: ", 1, 6);

      let newShape: Shape | null = null;

      switch (choice) {
        case 1: {
          const length = await readPositiveNumber(reader, "Enter width: ");
          const width = await readPositiveNumber(reader, "Enter height: ");
          newShape = new Rectangle(length, width);
          break;
        }
        case 2: {
          const side = await readPositiveNumber(reader, "Enter side length: ");
          newShape = new Square(side);
          break;
        }
        case 3:
          newShape = await readTriangle(reader);
          break;
        case 4: {
          const semiMajorAxis = await readPositiveNumber(
            reader,
            "Enter semi-major axis length: ",
          );
          const semiMinorAxis = await readPositiveNumber(
            reader,
            "Enter semi-minor axis length: ",
          );
          newShape = new Oval(semiMajorAxis, semiMinorAxis);
          break;
        }
        case 5: {
          const radius = await readPositiveNumber(reader, "Enter radius: ");
          newShape = new Circle(radius);
          break;
        }
        case 6:
          done = true;
          break;
      }

      if (newShape !== null) {
        console.log(`Added a ${newShape.getName()}.`);
        shapes.add(newShape);
      }
    }
  } catch (error) {
    if (error instanceof InputExhausted) {
      console.log("\nNo more input available; wrapping up.");
    } else {
      throw error;
    }
  } finally {
    rl.close();
  }

  printStatistics(shapes);
}

main();
