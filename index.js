const fs = require("fs");
const path = require("path");
const axios = require("axios");
const ExcelJS = require("exceljs");

// Таблица 
let table = {};
let associative_table = [];
let associative_table_index = 2;

// Создаём таблицу
const workbook = new ExcelJS.Workbook();
// Создаём таблицу и делаем header
const sheet = workbook.addWorksheet('score_table');
sheet.columns = [
    {
        header: "Время",
        key: "time",
        width: 10
    },
    {
        header: "Название",
        key: "name",
        width: 64
    },
    {
        header: "тотал на начало игры",
        key: "total_1",
        width: 22
    },
    {
        header: "кэф. нач игры Б",
        key: "ratio_1_more",
        width: 22
    },
    {
        header: "кэф. нач игры М",
        key: "ratio_1_less",
        width: 22
    },
    {
        header: "итог первой чет",
        key: "quarter_1",
        width: 22
    },
    {
        header: "тотал на начало 2 чет",
        key: "total_2",
        width: 22
    },
    {
        header: "кэф. 2 чет Б",
        key: "ratio_2_more",
        width: 22
    },
    {
        header: "кэф. 2 чет М",
        key: "ratio_2_less",
        width: 22
    },
    {
        header: "итог второй чет",
        key: "quarter_2",
        width: 22
    },
    {
        header: "тотал на начало 3 чет",
        key: "total_3",
        width: 22
    },
    {
        header: "кэф. 3 чет Б",
        key: "ratio_3_more",
        width: 22
    },
    {
        header: "кэф. 3 чет М",
        key: "ratio_3_less",
        width: 22
    },
    {
        header: "итог 3 чет",
        key: "quarter_3",
        width: 22
    },
    {
        header: "тотал на начало 4 чет",
        key: "total_4",
        width: 22
    },
    {
        header: "кэф. 4 чет Б",
        key: "ratio_4_more",
        width: 22
    },
    {
        header: "кэф. 4 чет М",
        key: "ratio_4_less",
        width: 22
    },
    {
        header: "итог на 4 чет",
        key: "quarter_4",
        width: 22
    },
    {
        header: "итог игры",
        key: "score_end",
        width: 22
    }
];

/**
 * Получение параметра запуска по имени
 * @param {string} name 
 * @param {any} defValue 
 * @returns 
 */
const getArg = (name, defValue = true) => {
    const argIndex = process.argv.indexOf(`--${name}`);
    return (argIndex !== -1) ? (process.argv[argIndex + 1]) ?? defValue : defValue;
}

/**
 * Получение времени с начала матча
 * @param {object} event
 * @returns {string}
 */
const getTime = (event) => {
    const unix_seconds = Math.round(+new Date()/1000);
    const start = event.miscs.timerUpdateTimestampMsec/1000;
    const minutes = (Math.round((unix_seconds - start)/60) % 60)-1;
    const seconds = (unix_seconds - start) % 60;
    return ((minutes.toString().length < 2) ? "0"+minutes.toString() : minutes.toString()) + ":" + ((seconds.toString().length < 2) ? "0"+seconds.toString() : seconds.toString());
}

/**
 * Если есть ассоциация с текущим мероприятием - получаем, если нет - создаём
 * @param {object} event 
 * @returns {object}
 */
const getAssociation = (event) => {
    const eventId = event.id.toString();
    
    let association = {};
    if (!(association = associative_table.filter(i => i.id === eventId).pop())) {
        association = {
            id: eventId,
            rowIndex: associative_table_index,
            // Функция обновления ассоциации
            update: function () {
                let tryGet;
                if (tryGet = associative_table.filter(i => i.id === eventId).pop()) {
                    associative_table[associative_table.indexOf(tryGet)] = this;
                } else {
                    associative_table.push(this);
                }
            }
        };
        associative_table.push(association);
        associative_table_index++;
    }
    
    return association;
}

/**
 * Получаем нужные нам показатели
 * @param {object} factors 
 */
const getNeedleFactors = (factors) => {
    /**
     * 921 - исход 1
     * 923 - исход 2
     * 927 - фора 1
     * 928 - фора 2
     * 930 - тотал Б
     * 931 - тотал М
     */
    const getFactorById = (id) => {
        return factors.factors.filter(f => f.f === id).pop();
    }

    const total_more = getFactorById(930);
    const total_less = getFactorById(931);

    return {
        total: (total_more) ? total_more.pt : null,
        total_more: (total_more) ? total_more.v.toString() : null,
        total_less: (total_less) ? total_less.v.toString() : null
    }
}

/**
 * Получение четвертей мероприятия
 * @param {object} event 
 * @returns {object}
 */
const getQuaters = (event) => {
    const getQuater = (number) => {
        return event.childs.filter(i => i.name === `${number}-я четверть`).pop();
    }

    const quater_1 = getQuater(1);
    const quater_2 = getQuater(2);
    const quater_3 = getQuater(3);
    const quater_4 = getQuater(4);

    return {
        quater_1: (quater_1) ? getNeedleFactors(quater_1.factors) : null,
        quater_2: (quater_2) ? getNeedleFactors(quater_2.factors) : null,
        quater_3: (quater_3) ? getNeedleFactors(quater_3.factors) : null,
        quater_4: (quater_4) ? getNeedleFactors(quater_4.factors) : null,
    }
}

/***
 * Обновление таблицы
 */
const update = async(pathResult) => {
    try {
        const response = await axios.get('https://line120.bkfon-resources.com/events/list?lang=ru&version=7188570617&scopeMarket=1600');
        const data = response.data;

        /**
         * Получение спорта и дочерних мероприятий к нему
         * @param {string} name 
         * @param {number} nestingLevel 
         * @returns {object}
         */
         const getTreeFor = (name = "Баскетбол", nestingLevel = 2) => {
            const sport = data["sports"].filter(item => item.name === name && item.kind === "sport").pop();
            let childs = [];
            let availableChilds = [];

            for (let i = 0; i < nestingLevel; i++) {

                switch (i) {
                    case 0:
                        // Find childs of sport
                        childs = data["sports"].filter(item => item.parentId === sport.id && item.kind === "segment");
                        break;
                    case 1:
                        // Find events of sport childs
                        for (let parent of childs) {
                            let events;
                            if ((events = data["events"].filter(
                                (item) => {
                                    if (item.sportId === parent.id && !item.parentId && data["eventBlocks"].filter(eventBlocked => eventBlocked.eventId === item.id).length === 0) {
                                        // Get event miscs
                                        if (item.miscs = data["eventMiscs"].filter(eventMiscs => eventMiscs.id === item.id).pop())
                                            // Get custom factors
                                            if (item.factors = data["customFactors"].filter(factor => factor.e === item.id).pop())
                                                if (item.childs = data["events"].filter(child => {
                                                    if (child.parentId === item.id)
                                                        if (child.miscs = data["eventMiscs"].filter(eventMiscs => eventMiscs.id === child.id).pop())
                                                            if (child.factors = data["customFactors"].filter(factor => factor.e === child.id).pop())
                                                            return child;
                                                }))
                                                    return item;
                                    }
                                }
                            )).length > 0) {
                                parent.events = events;
                                availableChilds.push(parent);
                            }
                        }
                        break;
                }
            }

            sport.childs = availableChilds;

            return sport;
        }

        table = getTreeFor("Баскетбол")
    } catch (e) {
        console.log(e);
    }

    // Самый вкусный процесс - запись по листам, создание ассоциаций и т.д.
    for (let sport_child of table["childs"]) {
        for (let child_event of sport_child["events"]) {
            // Получаем ассоциацию
            const association = getAssociation(child_event);

            // Получаем время
            const time = getTime(child_event); 
            if (!time) continue;
            // Получаем название матча
            const name = `${child_event.team1} - ${child_event.team2}`;
            // Получаем четверти
            const quaters = getQuaters(child_event);

            // Получаем строчку таблицы, отвечающую за текущее мероприятие
            const eventRow = sheet.getRow(association.rowIndex);
            let values = {
                time,
                name
            };

            // Цикл заполнения информации о четвертях
            for (let i = 1; i < 4; i++) {
                if (quaters[`quater_${i}`] && !association[`quater_${i}`]) {
                    association[`quater_${i}`] = true;
                    association[`total_${i}`] = quaters[`quater_${i}`].total;
                    association[`total_${i}_more`] = quaters[`quater_${i}`].total_more;
                    association[`total_${i}_less`] = quaters[`quater_${i}`].total_less;
                    association.update();
                }
                
                if (association[`total_${i}`])
                    values[`total_${i}`] = association[`total_${i}`];
                if (association[`total_${i}_more`])
                    values[`ratio_${i}_more`] = association[`total_${i}_more`];
                if (association[`total_${i}_less`])
                    values[`ratio_${i}_less`] = association[`total_${i}_less`];
            }
            eventRow.values = values;
        }
    }

    workbook.xlsx.writeFile(pathResult);

    console.log("Успешное обновление")
}

const start = async() => {
    // Папка с результатами
    const resultsPath = path.join(__dirname, "results");
    
    // Создаём папку для результатов (если нет)
    if (!fs.existsSync(resultsPath))
        fs.mkdirSync(resultsPath);

    // Получаем параметры запуска
    const timeUpdate = getArg("time", 1);
    const pathResult = path.join(resultsPath, `${getArg("name", "result")}.xlsx`);

    console.log("[Парсер] Запущен");
    console.log(`Интерал обновления: ${timeUpdate * 60} секунд`);
    console.log(`Путь к результату: ${pathResult}`);

    // Парсим и запускаем парсинг в поток
    await update(pathResult);

    setInterval (async() => {
        await update(pathResult);
    }, timeUpdate*60*1000);
}

start();