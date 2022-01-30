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
    const start = (event.miscs.timerUpdateTimestampMsec) ? event.miscs.timerUpdateTimestampMsec / 1000 : event.startTime;
    const minutes = (Math.round((unix_seconds - start)/60) % 60).toString();
    const seconds = ((unix_seconds - start) % 60).toString();
    return ((minutes.length < 2) ? "0"+minutes : minutes) + ":" + ((seconds.length < 2) ? "0"+seconds : seconds);
}

/**
 * Получение итогов мероприятия
 * @param {object} event 
 */
const getScores = (event) => {
    const regex = /(\d+-\d+)/gs;
    const comment = event.miscs.comment;
    const scores = [];
    while ((m = regex.exec(comment)) !== null) {
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }
        m.forEach((match) => {
            scores.push(match);
        });
    }
    return scores;
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
const getquarters = (event) => {
    const getquarter = (number) => {
        return event.childs.filter(i => i.name === `${number}-я четверть`).pop();
    }

    const quarter_1 = getquarter(1);
    const quarter_2 = getquarter(2);
    const quarter_3 = getquarter(3);
    const quarter_4 = getquarter(4);

    return {
        quarter_1: (quarter_1) ? getNeedleFactors(quarter_1.factors) : null,
        quarter_2: (quarter_2) ? getNeedleFactors(quarter_2.factors) : null,
        quarter_3: (quarter_3) ? getNeedleFactors(quarter_3.factors) : null,
        quarter_4: (quarter_4) ? getNeedleFactors(quarter_4.factors) : null,
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
            const quarters = getquarters(child_event);

            // Получаем строчку таблицы, отвечающую за текущее мероприятие
            const eventRow = sheet.getRow(association.rowIndex);
            let values = {
                time,
                name
            };  

            // Получаем итоги четвертей
            let result_scores = getScores(child_event);

            // Цикл заполнения информации о четвертях
            for (let i = 1; i < 4; i++) {
                if (quarters[`quarter_${i}`] && !association[`quarter_${i}_writed`]) {
                    association[`quarter_${i}_writed`] = true;

                    association[`total_${i}`] = quarters[`quarter_${i}`].total;
                    association[`total_${i}_more`] = quarters[`quarter_${i}`].total_more;
                    association[`total_${i}_less`] = quarters[`quarter_${i}`].total_less;

                    association.update();
                }

                // Записываем итоги игры после окончания четвертей
                if (result_scores[i-1] && i > 1) {
                    association[`quarter_${i-1}`] = result_scores[i-1];
                    association.update();
                }
                
                if (association[`total_${i}`])
                    values[`total_${i}`] = association[`total_${i}`];
                if (association[`total_${i}_more`])
                    values[`ratio_${i}_more`] = association[`total_${i}_more`];
                if (association[`total_${i}_less`])
                    values[`ratio_${i}_less`] = association[`total_${i}_less`];
                if (association[`quarter_${i-1}`])
                    values[`quarter_${i-1}`] = association[`quarter_${i-1}`];
            }

            // Итог игры
            if (result_scores[5])
                values[`score_end`] = result_scores[5];

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