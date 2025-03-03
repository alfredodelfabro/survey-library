import { Base, SurveyError, ISurveyErrorOwner } from "./base";
import { CustomError, RequreNumericError } from "./error";
import { surveyLocalization } from "./surveyStrings";
import { ILocalizableOwner, LocalizableString } from "./localizablestring";
import { Serializer } from "./jsonobject";
import { ConditionRunner } from "./conditions";
import { Helpers } from "./helpers";

export class ValidatorResult {
  constructor(public value: any, public error: SurveyError = null) {}
}
/**
 * Base SurveyJS validator class.
 */
export class SurveyValidator extends Base {
  public errorOwner: ISurveyErrorOwner;
  constructor() {
    super();
    this.createLocalizableString("text", this, true);
  }
  public get text(): string {
    return this.getLocalizableStringText("text");
  }
  public set text(value: string) {
    this.setLocalizableStringText("text", value);
  }
  public get isValidateAllValues() {
    return false;
  }
  get locText(): LocalizableString {
    return this.getLocalizableString("text");
  }
  protected getErrorText(name: string): string {
    if (this.text) return this.text;
    return this.getDefaultErrorText(name);
  }
  protected getDefaultErrorText(name: string): string {
    return "";
  }
  public validate(value: any, name: string = null): ValidatorResult {
    return null;
  }
  public validateAllValues(
    value: any,
    values: any,
    properties: any,
    name: string = null
  ): ValidatorResult {
    return null;
  }
  getLocale(): string {
    return !!this.errorOwner ? this.errorOwner.getLocale() : "";
  }
  getMarkdownHtml(text: string): string {
    return !!this.errorOwner ? this.errorOwner.getMarkdownHtml(text) : null;
  }
  getProcessedText(text: string): string {
    return !!this.errorOwner ? this.errorOwner.getProcessedText(text) : text;
  }
  protected createCustomError(name: string): SurveyError {
    return new CustomError(this.getErrorText(name), this.errorOwner);
  }
  public toString(): string {
    var res = this.getType().replace("validator", "");
    if (!!this.text) {
      res += ", " + this.text;
    }
    return res;
  }
}
export interface IValidatorOwner {
  validators: Array<SurveyValidator>;
  validatedValue: any;
  getValidatorTitle(): string;
  getDataFilteredValues(): any;
  getDataFilteredProperties(): any;
}
export class ValidatorRunner {
  public run(owner: IValidatorOwner): Array<SurveyError> {
    var res = [];
    for (var i = 0; i < owner.validators.length; i++) {
      var validatorResult = null;
      var validator = owner.validators[i];
      if (!validator.isValidateAllValues) {
        validatorResult = validator.validate(
          owner.validatedValue,
          owner.getValidatorTitle()
        );
      } else {
        validatorResult = validator.validateAllValues(
          owner.validatedValue,
          owner.getDataFilteredValues(),
          owner.getDataFilteredProperties(),
          owner.getValidatorTitle()
        );
      }
      if (!!validatorResult && !!validatorResult.error) {
        res.push(validatorResult.error);
      }
    }
    return res;
  }
}
/**
 * Validate numeric values.
 */
export class NumericValidator extends SurveyValidator {
  constructor(public minValue: number = null, public maxValue: number = null) {
    super();
  }
  public getType(): string {
    return "numericvalidator";
  }
  public validate(value: any, name: string = null): ValidatorResult {
    if (Helpers.isValueEmpty(value)) return null;
    if (!this.isNumber(value)) {
      return new ValidatorResult(
        null,
        new RequreNumericError(null, this.errorOwner)
      );
    }
    var result = new ValidatorResult(parseFloat(value));
    if (this.minValue !== null && this.minValue > result.value) {
      result.error = this.createCustomError(name);
      return result;
    }
    if (this.maxValue !== null && this.maxValue < result.value) {
      result.error = this.createCustomError(name);
      return result;
    }
    return typeof value === "number" ? null : result;
  }
  protected getDefaultErrorText(name: string) {
    var vName = name ? name : surveyLocalization.getString("value");
    if (this.minValue !== null && this.maxValue !== null) {
      return surveyLocalization
        .getString("numericMinMax")
        ["format"](vName, this.minValue, this.maxValue);
    } else {
      if (this.minValue !== null) {
        return surveyLocalization
          .getString("numericMin")
          ["format"](vName, this.minValue);
      }
      return surveyLocalization
        .getString("numericMax")
        ["format"](vName, this.maxValue);
    }
  }
  private isNumber(value: any): boolean {
    return !isNaN(parseFloat(value)) && isFinite(value);
  }
}
/**
 * Validate text values.
 */
export class TextValidator extends SurveyValidator {
  constructor(
    public minLength: number = 0,
    public maxLength: number = 0,
    public allowDigits = true
  ) {
    super();
  }
  public getType(): string {
    return "textvalidator";
  }
  public validate(value: any, name: string = null): ValidatorResult {
    if (value !== "" && Helpers.isValueEmpty(value)) return null;
    if (!this.allowDigits) {
      var reg = /^[A-Za-z\s]*$/;
      if (!reg.test(value)) {
        return new ValidatorResult(null, this.createCustomError(name));
      }
    }
    if (this.minLength > 0 && value.length < this.minLength) {
      return new ValidatorResult(null, this.createCustomError(name));
    }
    if (this.maxLength > 0 && value.length > this.maxLength) {
      return new ValidatorResult(null, this.createCustomError(name));
    }
    return null;
  }
  protected getDefaultErrorText(name: string) {
    if (this.minLength > 0 && this.maxLength > 0)
      return surveyLocalization
        .getString("textMinMaxLength")
        ["format"](this.minLength, this.maxLength);
    if (this.minLength > 0)
      return surveyLocalization
        .getString("textMinLength")
        ["format"](this.minLength);
    return surveyLocalization
      .getString("textMaxLength")
      ["format"](this.maxLength);
  }
}

export class AnswerCountValidator extends SurveyValidator {
  constructor(public minCount: number = null, public maxCount: number = null) {
    super();
  }
  public getType(): string {
    return "answercountvalidator";
  }
  public validate(value: any, name: string = null): ValidatorResult {
    if (value == null || value.constructor != Array) return null;
    var count = value.length;
    if (this.minCount && count < this.minCount) {
      return new ValidatorResult(
        null,
        this.createCustomError(
          surveyLocalization
            .getString("minSelectError")
            ["format"](this.minCount)
        )
      );
    }
    if (this.maxCount && count > this.maxCount) {
      return new ValidatorResult(
        null,
        this.createCustomError(
          surveyLocalization
            .getString("maxSelectError")
            ["format"](this.maxCount)
        )
      );
    }
    return null;
  }
  protected getDefaultErrorText(name: string) {
    return name;
  }
}
/**
 * Use it to validate the text by regular expressions.
 */
export class RegexValidator extends SurveyValidator {
  constructor(public regex: string = null) {
    super();
  }
  public getType(): string {
    return "regexvalidator";
  }
  public validate(value: any, name: string = null): ValidatorResult {
    if (!this.regex || Helpers.isValueEmpty(value)) return null;
    var re = new RegExp(this.regex);
    if (Array.isArray(value)) {
      for (var i = 0; i < value.length; i++) {
        var res = this.hasError(re, value[i], name);
        if (res) return res;
      }
    }
    return this.hasError(re, value, name);
  }
  private hasError(re: RegExp, value: any, name: string): ValidatorResult {
    if (re.test(value)) return null;
    return new ValidatorResult(value, this.createCustomError(name));
  }
}
/**
 * Validate e-mail address in the text input
 */
export class EmailValidator extends SurveyValidator {
  private re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
  constructor() {
    super();
  }
  public getType(): string {
    return "emailvalidator";
  }
  public validate(value: any, name: string = null): ValidatorResult {
    if (!value) return null;
    if (this.re.test(value)) return null;
    return new ValidatorResult(value, this.createCustomError(name));
  }
  protected getDefaultErrorText(name: string) {
    return surveyLocalization.getString("invalidEmail");
  }
}

/**
 * Show error if expression returns false
 */
export class ExpressionValidator extends SurveyValidator {
  private conditionRunner: ConditionRunner = null;
  public expression: string;
  constructor() {
    super();
  }
  public getType(): string {
    return "expressionvalidator";
  }
  public get isValidateAllValues() {
    return true;
  }
  public validateAllValues(
    value: any,
    values: any,
    properties: any,
    name: string = null
  ): ValidatorResult {
    if (!this.expression) return null;
    if (!this.conditionRunner) {
      this.conditionRunner = new ConditionRunner(this.expression);
    }
    this.conditionRunner.expression = this.expression;
    var res = this.conditionRunner.run(values, properties);
    if (!res) {
      return new ValidatorResult(value, this.createCustomError(name));
    }
    return null;
  }
  protected getDefaultErrorText(name: string) {
    return surveyLocalization
      .getString("invalidExpression")
      ["format"](this.expression);
  }
}

Serializer.addClass("surveyvalidator", [
  { name: "text", serializationProperty: "locText" }
]);
Serializer.addClass(
  "numericvalidator",
  ["minValue:number", "maxValue:number"],
  function() {
    return new NumericValidator();
  },
  "surveyvalidator"
);
Serializer.addClass(
  "textvalidator",
  ["minLength:number", "maxLength:number", "allowDigits:boolean"],
  function() {
    return new TextValidator();
  },
  "surveyvalidator"
);
Serializer.addClass(
  "answercountvalidator",
  ["minCount:number", "maxCount:number"],
  function() {
    return new AnswerCountValidator();
  },
  "surveyvalidator"
);
Serializer.addClass(
  "regexvalidator",
  ["regex"],
  function() {
    return new RegexValidator();
  },
  "surveyvalidator"
);
Serializer.addClass(
  "emailvalidator",
  [],
  function() {
    return new EmailValidator();
  },
  "surveyvalidator"
);

Serializer.addClass(
  "expressionvalidator",
  ["expression:condition"],
  function() {
    return new ExpressionValidator();
  },
  "surveyvalidator"
);
