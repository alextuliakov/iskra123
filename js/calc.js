//var bigDec = require('big-decimal.min.js');

/* 
 * Константы, определяющие режимы работы калькулятора
 */
const MANUAL_MODE = 0; // Ручной счёт
const RUNTIME_MODE = 1; // Счёт по программе
const PROG_MODE = 2; // Ввод программы
const DEBUG_MODE = 3; // Пошаговый просмотр программы
const MAX_PROG_SIZE = 71; // Максимальное количество шагов в программе

//Коды комманд (клавиш)
const CMD_CODES = {
    '0': '1.0', '1': '1.1', '2': '1.2', '3': '1.3',
    '4': '1.4', '5': '1.5', '6': '1.6', '7': '1.7',
    '8': '1.8', '9': '1.9', 'a1': '4.0', 'a2': '4.6',
    'a3': '4.7', 'a4': '4.5', 'a5': '4.4', '[2]+': '5.6',
    '[3]+': '5.7', 'add': '2.2', 'subtract': '2.3', 'multiply': '2.4',
    'divide': '2.7', 'rdivide': '2.5', 'sqrt': '2.9', 'pow': '3.4',
    'equals': '2.0', ')': '2.1', ',': '8.0', '+-': '8.2', 'int': '8.4',
    '(': '8.8', 'printReg': '8.1', 'abs': '8.3', 'goto': '6.2', 'label': '6.1', 
    'progEnd': '6.4', 'stop': '6.8'
}

/* 
 * Вспомогательные константы для работы с HTML/CSS
 * (графическим интерфейсом калькулятора)
 */
const ID_SEGMENT_PREFIX = 'SEG';
const ID_COMMA_PREFIX = 'COMM';
const ID_SIGN = 'SIGN';

const COMMA_OFF_BGCOLOR = '#333';
const DISPLAY_FOREGROUND_COLOR = '#ff4f04';

/* 
 * Класс калькулятора с основными функциями и логикой работы.
 */
class Calculator {
    #mode = MANUAL_MODE; //текущий режим
    #operation; //текущая набранная операция
    #lastKey; //последняя нажатая клавиша
    #overflow; //есть ли переполнение?
    #newInput; //необходимо ли производить набор числа заново?
    #inputBuffer = ''; //входной буффер (строка набираемых символов / цифр)
    #precision = 0; //точность вычислений (0 означает - выключена)
    #pc = 0; // счётчик комманд (шагов) программы
    #label = -1; //метка (содержит номер шага программы, на который указвает метка)
    #turnOn = false; //включён ли калькулятор

    // для работы со скобками:
    #bracketsCount = 0;
    #savedOp = []; //операнды
    #savedOper = []; //операции

    stack = [0.0, 0.0, 0.0]; 
    memory = [0.0, 0.0, 0.0, 0.0, 0.0];

    display = null; 
    buttons = null; 
    precButtons = null;
    modeButtons = null;

    program = new Array(MAX_PROG_SIZE); // программа

    constructor() {
		this.display = document.getElementById('display');
        this.buttons = document.querySelectorAll('.keypad-btn');
        this.precButtons = document.querySelectorAll('input[type="radio"].btn-check[id^="p"]');
        this.modeButtons = document.querySelectorAll('input[type="radio"].btn-check[id^="mode-"]');
    }

    #getProgSize() {
        return this.program.filter(el => { return el !== undefined; }).length;
    }

    enterCmd(cmd) {
        if (this.#pc + 1 === MAX_PROG_SIZE) {
            this.raiseError('Max program size has been reached! (' + MAX_PROG_SIZE + ')');
        }
        this.updateDisplay();
        this.clearDisplay();

        if(this.program[this.#pc] !== undefined) {
            this.program[this.#pc+1] = cmd;
            this.#pc = (this.#pc + 1) % MAX_PROG_SIZE;
        } else this.program[this.#pc] = cmd;
            
        this.stack[0] = parseFloat(CMD_CODES[cmd]).toFixed(1);
        //console.log('PROGC: ' + this.stack[0]);
        this.updateDisplay();
    }

    execCmd(action) {
        if(!this.#turnOn && action !== 'ac') {
            this.raiseError('Перед началом работы включите калькулятор нажатием СК!');
            return;
        }
        if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ','].includes(action)) {
            if (action === ',') {
                if(this.#mode === PROG_MODE) {
                    this.enterCmd(',');
                }
                else this.inputDecimal();
            } else {
                if(this.#mode === PROG_MODE) {
                    this.enterCmd(action);
                } else {
                    this.inputDigit(action);
                }
            }
            this.#lastKey = 'number';
            console.log('LK: ' + action);
            //return;
        }
        else {
        switch(action) {
            case 'ac': // Полный сброс
                if(!this.#turnOn) {
                    this.#turnOn = true;
                    calc.modeButtons.forEach(rad => {
                        rad.disabled = false;
                    }); 
                    calc.precButtons.forEach(rad => {
                        rad.disabled = false;
                    }); 
                }
                this.#overflow = false;
                if (this.#mode === DEBUG_MODE) {
                    if(this.#pc > 0) {
                        this.#pc -= 1;
                        this.updateDisplay();
                        this.clearDisplay();
                        this.stack[0] = parseFloat(CMD_CODES[this.program[this.#pc]]).toFixed(1);
                        this.updateDisplay();
                    }
                }
                else if(this.#mode === PROG_MODE) {
                    this.setMode(DEBUG_MODE);
                    this.updateDisplay();
                    this.clearDisplay();
                    this.stack[0] = parseFloat(this.program[this.#pc]).toFixed(1);
                    this.updateDisplay();
                }
                else if (this.#mode === MANUAL_MODE) {
                    this.#inputBuffer = '';
                    this.stack[0] = 0;
                    if(this.#lastKey === 'equals') {
                        this.stack = [0, 0, 0];
                    }
                    this.#newInput = true;
                    this.#operation = '';
                    this.#lastKey = action;
                    this.clearDisplay();
                    this.updateDisplay();
                }
                console.log('LK: ' + this.#lastKey);
                break;
                
            case 'equals': // Вычисление
                if (this.#operation) {
                    this.#lastKey = action;
                    this.calculate();
                }
                this.#operation = '';
                //this.#lastKey = action;
                console.log('RES: ' + this.#lastKey);
                //this.updateDisplay();
                break;
            case '+-':
            case 'sqrt':
            case 'abs':
            case 'pow':
                this.#lastKey = action;
                this.applyOperation(action);
                break;
            case 'int':
                console.log('Cleared! ' + this.#inputBuffer);
                this.#lastKey = action;
                this.applyOperation(action);
                break;
            case 'add':
            case 'subtract':
            case 'multiply':
            case 'divide':
            case 'rdivide':
                if(this.#savedOper.length > 0 && this.#lastKey === ')') {
                    this.#operation = this.#savedOper.pop();
                    this.stack[1] = this.#savedOp.pop();
                    console.log('STACK: ' + this.stack + '; OPER: ' + this.#operation);
                    //this.execCmd('equals');
                    if (this.#operation) {
                        this.calculate();
                    }
                    console.log('STACK0: ' + this.stack[0]);
                    //this.#operation = action;
                }
                else if (!this.#newInput) {
                    if(this.#operation !== '') {
                        this.execCmd('equals');
                    }
                    this.liftStack();
                    this.#newInput = true;
                }
                this.#operation = action;
                this.#lastKey = action;
                break;
                
            case 'a1': 
                this.requestMemory(1);
                this.#lastKey = action;
                this.updateDisplay();
                break;
            case 'a2': 
                this.requestMemory(2);
                this.#lastKey = action;
                this.updateDisplay();
                break;
            case 'a3': 
                this.requestMemory(3);
                this.#lastKey = action;
                this.updateDisplay();
                break;
            case 'a4': 
                this.requestMemory(4);
                this.#lastKey = action;
                this.updateDisplay();
                break;
            case 'a5': 
                this.requestMemory(5);
                this.#lastKey = action;
                this.updateDisplay();
                break;
                
            case '[2]+': // Добавление к памяти
                //this.memory[1] += this.stack[0];
                this.memory[1] = bigDecimal.add(this.memory[1], this.stack[0]);
                this.#lastKey = action;
                this.updateDisplay();
                break;
                
            case '[3]+': // Добавление к памяти
                //this.memory[2] += this.stack[0];
                this.memory[2] = bigDecimal.add(this.memory[2], this.stack[0]);
                this.#lastKey = action;
                this.updateDisplay();
                break;
            case 'progEnd':
                if(this.#mode === MANUAL_MODE) {
                    this.#pc = 0;
                }
                this.#lastKey = action;
                break;
            case 'start':
                if(this.#mode === MANUAL_MODE) {
                    this.executeProgram();
                }
                else if (this.#mode === DEBUG_MODE) {
                    if(this.#pc < this.#getProgSize()-1) {
                        this.#pc += 1;
                        this.updateDisplay();
                        this.clearDisplay();
                        this.stack[0] = parseFloat(CMD_CODES[this.program[this.#pc]]).toFixed(1);
                        this.updateDisplay();
                    }
                }
                else if (this.#mode === PROG_MODE) {
                    this.setMode(DEBUG_MODE);
                    this.updateDisplay();
                    this.clearDisplay();
                    this.stack[0] = parseFloat(CMD_CODES[this.program[this.#pc]]).toFixed(1);
                    this.updateDisplay();
                }
                this.#lastKey = action;
                break;
            case 'stop':
                this.#lastKey = action;
                break;
            case 'label':
                this.#label = this.#pc;
                this.#lastKey = action;
                break;
            case 'goto':
                if (this.stack[0] < 0) {
                    this.#pc = this.#label;
                }
                this.#lastKey = action;
                break;
            case '(':
                if(this.#lastKey !== action) {
                    this.#savedOper.push(this.#operation);
                    this.#savedOp.push(this.stack[0]);
                }
                // if(this.#bracketsCount === 0) {
                //     this.stack[2] = this.stack[0];
                // }
                this.#operation = '';
                this.stack = [0.0, 0.0, 0.0];
                this.#bracketsCount++;
                this.#lastKey = action;
                this.#newInput = true;
                console.log('SavedOperands: ' + this.#savedOp);
                console.log('SavedOperations: ' + this.#savedOper);
                break;
            case ')':
                //this.execCmd('equals');
                this.calculate();
                // if(this.#savedOper.length >= this.#bracketsCount && this.#savedOp[this.#bracketsCount-1] !== undefined) {
                //     this.#operation = this.#savedOper.pop();
                //     this.stack[1] = this.#savedOp.pop();
                //     //this.execCmd('equals');
                //     if (this.#operation) {
                //         this.calculate();
                //     }
                //     this.#operation = '';
                // }
                // if(this.#bracketsCount === 1) {
                //     this.stack[1] = this.stack[2];
                //     this.#operation = this.#savedOper.pop();
                //     this.stack[1] = this.#savedOp.pop();
                // }
                this.#bracketsCount--;
                this.#lastKey = action;
                break;
        }
    }
    }

    executeProgram() {
        var cmd = this.program[this.#pc];
        while (cmd !== 'progEnd' && this.#pc < this.program.length) {
            this.execCmd(cmd);
            this.#pc++;
            cmd = this.program[this.#pc];
        }
        this.#pc = 0;
    }

    processKey(button) {
        // Обработка цифр
        if (button.hasAttribute('data-number')) {
            const number = button.getAttribute('data-number');
            console.log('Number pressed!');
            this.execCmd(number);
            return;
        }
        
        // Обработка действий
        if (button.hasAttribute('data-action')) {
            const action = button.getAttribute('data-action');
            if((this.#mode === PROG_MODE || this.#mode === DEBUG_MODE )&& !['ac', 'start'].includes(action)) {
                this.enterCmd(action);
            }
            else {
                console.log('Action pressed!');
                this.execCmd(action);
            }
        }
    }

    raiseError(msg) {
        alert(msg);
        console.log(msg);
    }

    setMode(m) {
        switch(m) {
            case MANUAL_MODE:
            case RUNTIME_MODE:
            case PROG_MODE:
            case DEBUG_MODE:
                this.#mode = m;
                this.#newInput = true;
                return 0;
            default:
                this.raiseError('Error [01]: Trying to set the unknown mode!');
                return -1;
        }
    }

    setPrecision(p) {
        if((p > 0 && p % 2 === 0) || (p > 13) || (p < 0)) {
            this.raiseError('Error [02]: Incorrect precision value!');
            return -1;
        }
        this.#precision = p;
        return 0;
    }

    clearCommas() {
        var i = 0;
        while(i < 16) {
            var comm = document.getElementById(ID_COMMA_PREFIX+i);
            comm.style.backgroundColor = COMMA_OFF_BGCOLOR;
            i++;
        }
    }

    clearDisplay() {
        var i = 0;
        while(i < 16) {
            var seg = document.getElementById(ID_SEGMENT_PREFIX+i);
            var comm = document.getElementById(ID_COMMA_PREFIX+i);
            seg.textContent = '';
            comm.style.backgroundColor = COMMA_OFF_BGCOLOR;
            i++;
        }
        document.getElementById(ID_SEGMENT_PREFIX+'0').textContent = '0';
    }

    updateDisplay() {
        let displayValue = '';
        if(this.#mode === PROG_MODE) {
            displayValue = parseFloat(this.stack[0]).toFixed(1).toString();
        }
        else {
            displayValue = parseFloat(this.stack[0]).toString();
        }
        
        //console.log('DV: ' + displayValue);
        if(displayValue < 0) {
            if(displayValue.includes('-')) {
                displayValue = displayValue.replace('-', '');
            }
            document.getElementById(ID_SIGN).style.backgroundColor = DISPLAY_FOREGROUND_COLOR;
        }
        else {
            document.getElementById(ID_SIGN).style.backgroundColor = '#000';
        }

        // Форматирование числа, если задана точность
        if (displayValue.includes('.')) {
            let spis = ['pow', 'equals', '+-', 'sqrt', 'abs', 'add', 'subtract', 'multiply', 'div', 'rdiv'];
            if(this.#precision !== 0 && spis.includes(this.#lastKey) && this.#mode !== PROG_MODE) {
                displayValue = parseFloat(this.stack[0]).toFixed(this.#precision);
            }
        }
        
        // Замена точки на запятую
        displayValue = displayValue.replace('.', ',');
        
        // Добавление нуля перед запятой, если нужно
        if (displayValue.startsWith(',')) {
            displayValue = '0' + displayValue;
        }
        
        // Переполнение
        if (Math.abs(Math.trunc(displayValue)).toString().length > 16) {
            this.#overflow = true;
            //alert("ПЕРЕПОЛНЕНИЕ!!!");
        }

        if(this.#overflow) {
            this.showOverflow();
        }
        else {
            //Когда нет переполнения

            //Отображение запятой, если число вещественное
            if(displayValue.includes(',')) {
                const commPos = displayValue.indexOf(',') - 1;
                document.getElementById(ID_COMMA_PREFIX+commPos).style.backgroundColor = DISPLAY_FOREGROUND_COLOR;
                displayValue = displayValue.replace(',', '');
            }
            else if(this.#inputBuffer.includes(',')) {
                const commPos = this.#inputBuffer.indexOf(',') - 1;
                document.getElementById(ID_COMMA_PREFIX+commPos).style.backgroundColor = DISPLAY_FOREGROUND_COLOR;
            }

            //Отображение цифр числа
            var i = 0;
            while(i < displayValue.length) {
                var seg = document.getElementById(ID_SEGMENT_PREFIX+i);
                seg.textContent = displayValue.charAt(i);
                i++;
            }
        }
    }

    showOverflow() {
        var i = 0;
        while(i < 16) {
            var seg = document.getElementById('SEG'+i);
            var comm = document.getElementById('COMM'+i);
            comm.style.backgroundColor = '#ff4f04';
            i++;
        }
    }

    clearRegisters() {
        this.stack = [0, 0, 0];
        this.#inputBuffer = '';
    }

    requestMemory(reg) {
        let lastKey = this.#lastKey;
        let cond1 = ['number', 'sqrt', 'pow', 'int', '+-', 'equals', ')', 'abs']
        let cond2 = ['add', 'subtract', 'multiply', 'divide', 'rdivide', 
            '[2]+', '[3]+', 'printReg', 'label', 'ac', 'goto', 'progEnd', 'stop', 
            'a1', 'a2', 'a3', 'a4', 'a5'];
        if (cond1.includes(lastKey)) {
            this.memory[reg-1] = this.stack[0];
            switch(reg) {
                case 1:
                    this.#lastKey = 'a1';
                    break;
                case 2:
                    this.#lastKey = 'a2';
                    break;
                case 3:
                    this.#lastKey = 'a3';
                    break;
                case 4:
                    this.#lastKey = 'a4';
                    break;
                case 5:
                    this.#lastKey = 'a5';
                    break;
                default:
                    this.raiseError("ОШИБКА[05]: Неизвестный регистр памяти!");
                    return -1;
            }
            this.#newInput = true;
        }
        else if (cond2.includes(lastKey)) {
            this.#newInput = false;
            this.#inputBuffer = '';
            this.clearDisplay();
            switch(reg) {
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                    this.#inputBuffer += this.memory[reg-1];
                    break;
                default:
                    this.raiseError("ОШИБКА[05]: Неизвестный регистр памяти!");
                    return -1;
            }
            this.stack[0] = parseFloat(this.#inputBuffer.replace(',', '.'));
        }
        return 0;
    }

    // Обработка ввода цифр
    inputDigit(digit) {
        if (this.#newInput) {
            this.clearDisplay();
            this.#inputBuffer = digit;
            this.#newInput = false;
        } else {
            if (this.#inputBuffer.length <= 16) {
                if(this.#lastKey === 'number' && this.#inputBuffer === '0') {
                    this.#inputBuffer = '0,' + digit;
                }
                else if (this.#inputBuffer !== '0') this.#inputBuffer += digit;
            }
        }
        this.stack[0] = parseFloat(this.#inputBuffer.replace(',', '.'));
        this.updateDisplay();
    }

    // Обработка ввода запятой
    inputDecimal() {
        if (this.#newInput) {
            this.#inputBuffer = '0,';
            this.#newInput = false;
        } else if (!this.#inputBuffer.includes(',')) {
            this.#inputBuffer += ',';
        } 
        this.stack[0] = parseFloat(this.#inputBuffer.replace(',', '.'));
        this.updateDisplay();
    }

    applyOperation(op) {
        const x = this.stack[0];
        let result;
        switch(op) {
            case 'pow':
                result = bigDecimal.multiply(x, x);
                break;
            case 'abs':
                result = bigDecimal.abs(x);
                break;
            case 'int':
                result = Math.trunc(x);
                this.clearCommas();
                this.#inputBuffer = result.toString();
                break;
            case 'sqrt':
                if (x < 0) {
                    this.#overflow = true;
                    this.showOverflow();
                    return;
                }
                result = Math.sqrt(x);
                break;
            case '+-':
                result = -x;
                break;
            default:
                return;
        }
        
        this.stack[0] = result;

        this.clearDisplay();
        this.updateDisplay();
    }

    calculate() {
        const x = this.stack[0];
        const y = this.stack[1];
        //console.log('stack: ' + this.stack);
        let result;

        switch(this.#operation) {
            case 'add':
                result = y + x;
                break;
            case 'subtract':
                result = y - x;
                break;
            case 'multiply':
                result = y * x;
                break;
            case 'divide':
                if (x === 0) {
                    this.#overflow = true;
                    this.updateDisplay();
                    this.raiseError("ОШИБКА[04]: Деление на ноль!");
                    return;
                }
                result = y / x;
                //result = result.round(16);
                break;
            case 'rdivide':
                if (y === 0) {
                    this.#overflow = true;
                    this.updateDisplay();
                    this.raiseError("ОШИБКА[04]: Деление на ноль!");
                    return;
                }
                result = x / y;
                break;
            // case 'pow':
            //     result = Math.pow(y, x);
            //     break;
            default:
                return;
        }
        //console.log('DIGC: ' + this.intDigitCount(result));
        console.log('res: ' + result);
        let tmp = result.toFixed(16 - this.intDigitCount(result));
        let t_str = String(tmp);
        if(t_str.charAt(t_str.length - 1) === '0')
            this.stack[0] = result.toFixed(16-this.intDigitCount(result) + 1);
        else
            this.stack[0] = tmp;
        console.log('S[0]: ' + this.stack[0]);
        this.liftStack();
        this.clearDisplay();
        this.updateDisplay();
    }

    liftStack() {
        this.stack[1] = this.stack[0];
    }

    intDigitCount(n) {
        let val = String(Math.abs(Math.trunc(n)));
        return val.length;
    }

    getMode() { return this.#mode; }
    getInputBuffer() { return this.#inputBuffer; }
    isOverflow() {return this.#overflow; }
    isNewInput() { return this.#newInput; }
    getLastKey() { return this.#lastKey; }
    getCurrentOperation() { return this.#operation; }
    getPrecision() { return this.#precision; }
    isOn() { return this.#turnOn; }
	
}

document.addEventListener('DOMContentLoaded', function() {
    calc = new Calculator();

    if(!calc.isOn()) {
        calc.modeButtons.forEach(rad => {
            rad.disabled = true;
        }); 
        calc.precButtons.forEach(rad => {
            rad.disabled = true;
        }); 
    }

    // Обработчик нажатия на переключатели режиов калькулятора
    calc.modeButtons.forEach(rad => {
        rad.addEventListener('change', () => {
            if(rad.checked) {
                let p = rad.id.substring(5, rad.id.length);
                if(p === 'P') {
                    calc.setMode(PROG_MODE);
                    alert('Калькулятор переключён в режим: программируемый!');
                }
                else {
                    calc.clearDisplay();
                    calc.setMode(MANUAL_MODE);
                    alert('Калькулятор переключён в режим: ручного счёта и выполнения по программе!');
                }
            }
        });
    });

    // Обработчик нажатия на клавиши точности вычислений
    calc.precButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            if(radio.checked) {
                let p = radio.id.substring(1, radio.id.length);
                if(p === 'V') {
                    calc.setPrecision(0);
                    alert('Точность: выключена.');
                }
                else {
                    calc.setPrecision(parseInt(p));
                    alert('Точность: ' + calc.getPrecision() + ' знаков после запятой.');
                }
            }
        });
    });

    // Подключение обработчика нажатия на остальные клавиши калькулятора
    calc.buttons.forEach(button => {
        button.addEventListener('click', () => calc.processKey(button));
    });
    
});