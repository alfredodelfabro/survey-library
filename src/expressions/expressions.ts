import { HashTable, Helpers } from "../helpers";
import { FunctionFactory } from "../functionsfactory";
import { ProcessValue } from "../conditionProcessValue";

export abstract class Operand {
  public abstract toString(): string;
  public abstract evaluate(processValue?: ProcessValue): any;
  public abstract setVariables(variables: Array<string>): any;
  public hasFunction(): boolean {
    return false;
  }
}

export class BinaryOperand extends Operand {
  private consumer: Function;
  constructor(
    private operatorName: string,
    private left: any = null,
    private right: any = null,
    isArithmeticOp: boolean = false
  ) {
    super();
    if (isArithmeticOp) {
      this.consumer = OperandMaker.binaryFunctions["arithmeticOp"](
        operatorName
      );
    } else {
      this.consumer = OperandMaker.binaryFunctions[operatorName];
    }

    if (this.consumer == null) {
      OperandMaker.throwInvalidOperatorError(operatorName);
    }
  }

  private evaluateParam(x: any, processValue?: ProcessValue): any {
    return x == null ? null : x.evaluate(processValue);
  }

  public evaluate(processValue?: ProcessValue): any {
    return this.consumer.call(
      this,
      this.evaluateParam(this.left, processValue),
      this.evaluateParam(this.right, processValue)
    );
  }

  public toString(): string {
    return (
      "(" +
      OperandMaker.safeToString(this.left) +
      " " +
      OperandMaker.operatorToString(this.operatorName) +
      " " +
      OperandMaker.safeToString(this.right) +
      ")"
    );
  }

  public setVariables(variables: Array<string>) {
    if (this.left != null) this.left.setVariables(variables);
    if (this.right != null) this.right.setVariables(variables);
  }

  public hasFunction(): boolean {
    return (
      (!!this.left && this.left.hasFunction()) ||
      (!!this.right && this.right.hasFunction())
    );
  }
}

export class UnaryOperand extends Operand {
  private consumer: Function;
  constructor(private expression: Operand, private operatorName: string) {
    super();
    this.consumer = OperandMaker.unaryFunctions[operatorName];
    if (this.consumer == null) {
      OperandMaker.throwInvalidOperatorError(operatorName);
    }
  }

  public toString(): string {
    return (
      OperandMaker.operatorToString(this.operatorName) +
      this.expression.toString()
    );
  }

  public evaluate(processValue?: ProcessValue): boolean {
    let value = this.expression.evaluate(processValue);
    return this.consumer.call(this, value);
  }

  public setVariables(variables: Array<string>) {
    this.expression.setVariables(variables);
  }
}

export class ArrayOperand extends Operand {
  constructor(private values: Array<Operand>) {
    super();
  }

  public toString(): string {
    return (
      "[" +
      this.values
        .map(function(el: Operand) {
          return el.toString();
        })
        .join(", ") +
      "]"
    );
  }

  public evaluate(processValue?: ProcessValue): Array<any> {
    return this.values.map(function(el: Operand) {
      return el.evaluate(processValue);
    });
  }

  public setVariables(variables: Array<string>) {
    this.values.forEach(el => {
      el.setVariables(variables);
    });
  }

  public hasFunction(): boolean {
    return this.values.some(operand => operand.hasFunction());
  }
}

export class Const extends Operand {
  constructor(private value: any) {
    super();
  }

  public toString(): string {
    return this.value.toString();
  }

  public evaluate(): any {
    return this.getCorrectValue(this.value);
  }

  public setVariables(variables: Array<string>) {}
  protected getCorrectValue(value: any): any {
    if (!value || typeof value != "string") return value;
    if (this.isBooleanValue(value)) return value.toLowerCase() === "true";
    if (this.isNumericValue(value)) {
      if (value.indexOf("0x") == 0) return parseInt(value);
      return parseFloat(value);
    }
    return value;
  }
  private isBooleanValue(value: any): boolean {
    return (
      value &&
      (value.toLowerCase() === "true" || value.toLowerCase() === "false")
    );
  }
  private isNumericValue(value: any): boolean {
    if (
      value &&
      (value.indexOf("-") > -1 ||
        value.indexOf("+") > 1 ||
        value.indexOf("*") > -1 ||
        value.indexOf("^") > -1 ||
        value.indexOf("/") > -1 ||
        value.indexOf("%") > -1)
    )
      return false;
    var val = Number(value);
    if (isNaN(val)) return false;
    return isFinite(val);
  }
}

export class Variable extends Const {
  constructor(private variableName: string) {
    super(variableName);
  }

  public toString(): string {
    return "{" + this.variableName + "}";
  }

  public evaluate(processValue?: ProcessValue): any {
    var variableName = this.variableName.toLowerCase();
    return processValue.hasValue(variableName)
      ? this.getCorrectValue(processValue.getValue(variableName))
      : null;
  }
  public setVariables(variables: Array<string>) {
    variables.push(this.variableName);
  }
}

export class FunctionOperand extends Operand {
  constructor(
    private origionalValue: string,
    private parameters: ArrayOperand
  ) {
    super();
    if (Array.isArray(parameters) && parameters.length === 0) {
      this.parameters = new ArrayOperand([]);
    }
  }

  public evaluate(processValue?: ProcessValue): any {
    return FunctionFactory.Instance.run(
      this.origionalValue,
      this.parameters.evaluate(processValue),
      processValue.properties
    );
  }

  public toString() {
    return this.origionalValue + "(" + this.parameters.toString() + ")";
  }

  public setVariables(variables: Array<string>) {
    this.parameters.setVariables(variables);
  }

  public hasFunction(): boolean {
    return true;
  }
}

export class OperandMaker {
  static throwInvalidOperatorError(op: string) {
    throw new Error("Invalid operator: '" + op + "'");
  }

  static safeToString(operand: Operand): string {
    return operand == null ? "" : operand.toString();
  }

  static toOperandString(value: string): string {
    if (
      !!value &&
      (!OperandMaker.isNumeric(value) && !OperandMaker.isBooleanValue(value))
    )
      value = "'" + value + "'";
    return value;
  }

  static isNumeric(value: string): boolean {
    if (
      !!value &&
      (value.indexOf("-") > -1 ||
        value.indexOf("+") > 1 ||
        value.indexOf("*") > -1 ||
        value.indexOf("^") > -1 ||
        value.indexOf("/") > -1 ||
        value.indexOf("%") > -1)
    )
      return false;
    var val = Number(value);
    if (isNaN(val)) return false;
    return isFinite(val);
  }

  static isBooleanValue(value: string): boolean {
    return (
      !!value &&
      (value.toLowerCase() === "true" || value.toLowerCase() === "false")
    );
  }

  static unaryFunctions: HashTable<Function> = {
    empty: function(value: any): boolean {
      if (value == null) return true;
      return !value;
    },
    notempty: function(value: any): boolean {
      return !OperandMaker.unaryFunctions.empty(value);
    },
    negate: function(value: boolean): boolean {
      return !value;
    }
  };

  static binaryFunctions: HashTable<Function> = {
    arithmeticOp(operatorName: string) {
      return function(a: any, b: any): any {
        if (Helpers.isValueEmpty(a)) a = 0;
        if (Helpers.isValueEmpty(b)) b = 0;

        let consumer = OperandMaker.binaryFunctions[operatorName];
        return consumer == null ? null : consumer.call(this, a, b);
      };
    },
    and: function(a: boolean, b: boolean): boolean {
      return a && b;
    },
    or: function(a: boolean, b: boolean): boolean {
      return a || b;
    },
    plus: function(a: number, b: number): number {
      return a + b;
    },
    minus: function(a: number, b: number): number {
      return a - b;
    },
    mul: function(a: number, b: number): number {
      return a * b;
    },
    div: function(a: number, b: number): number {
      if (!b) return null;
      return a / b;
    },
    mod: function(a: number, b: number): number {
      if (!b) return null;
      return a % b;
    },
    power: function(a: number, b: number): number {
      return Math.pow(a, b);
    },
    greater: function(left: any, right: any): boolean {
      if (left == null || right == null) return false;
      return left > right;
    },
    less: function(left: any, right: any): boolean {
      if (left == null || right == null) return false;
      return left < right;
    },
    greaterorequal: function(left: any, right: any): boolean {
      if (left == null || right == null) return false;
      return left >= right;
    },
    lessorequal: function(left: any, right: any): boolean {
      if (left == null || right == null) return false;
      return left <= right;
    },
    equal: function(left: any, right: any): boolean {
      return Helpers.isTwoValueEquals(left, right, true);
    },
    notequal: function(left: any, right: any): boolean {
      return !Helpers.isTwoValueEquals(left, right, true);
    },
    contains: function(left: any, right: any): boolean {
      return OperandMaker.binaryFunctions.containsCore(left, right, true);
    },
    notcontains: function(left: any, right: any): boolean {
      if (!left && !Helpers.isValueEmpty(right)) return true;
      return OperandMaker.binaryFunctions.containsCore(left, right, false);
    },
    anyof: function(left: any, right: any): boolean {
      if (!left && Helpers.isValueEmpty(right)) return true;
      if (!left || !Array.isArray(left) || left.length === 0) return false;
      if (Helpers.isValueEmpty(right)) return true;
      if (!Array.isArray(right))
        return OperandMaker.binaryFunctions.contains(left, right);
      for (var i = 0; i < right.length; i++) {
        if (OperandMaker.binaryFunctions.contains(left, right[i])) return true;
      }
      return false;
    },
    allof: function(left: any, right: any): boolean {
      if (!left && !Helpers.isValueEmpty(right)) return false;
      if (!Array.isArray(right))
        return OperandMaker.binaryFunctions.contains(left, right);
      for (var i = 0; i < right.length; i++) {
        if (!OperandMaker.binaryFunctions.contains(left, right[i]))
          return false;
      }
      return true;
    },
    containsCore: function(left: any, right: any, isContains: any): boolean {
      if (!left) return false;
      if (!left.length) {
        left = left.toString();
      }
      if (typeof left === "string" || left instanceof String) {
        if (!right) return false;
        right = right.toString();
        var found = left.indexOf(right) > -1;
        return isContains ? found : !found;
      }
      var rightArray = Array.isArray(right) ? right : [right];
      for (var rIndex = 0; rIndex < rightArray.length; rIndex++) {
        var i = 0;
        right = rightArray[rIndex];
        for (; i < left.length; i++) {
          if (Helpers.isTwoValueEquals(left[i], right)) break;
        }
        if (i == left.length) return !isContains;
      }
      return isContains;
    }
  };

  static operatorToString(operatorName: string): string {
    let opStr = OperandMaker.signs[operatorName];
    return opStr == null ? operatorName : opStr;
  }

  static signs: HashTable<string> = {
    less: "<",
    lessorequal: "<=",
    greater: ">",
    greaterorequal: ">=",
    equal: "==",
    notequal: "!=",
    plus: "+",
    minus: "-",
    mul: "*",
    div: "/",
    and: "&&",
    or: "||",
    power: "^",
    mod: "%",
    negate: "!"
  };
}
