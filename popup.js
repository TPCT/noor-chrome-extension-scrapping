async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

function getTableData(){
    const table = document.querySelector("#ctl00_PlaceHolderMain_trGridMarks");
    const rows = document.querySelectorAll("#ctl00_PlaceHolderMain_trGridMarks tbody tr");
    const results = [];
    rows.forEach(function(row, index){
        if (index === 0){
            row.querySelectorAll("th").forEach(function(column, index){
                results.push({
                    log_column_name: column.innerText,
                    values: []
                })
            });
        }else{
            row.querySelectorAll('td').forEach(function (column, index){
                results[index].values.push(column.innerText);
            })
        }
    });

    return {
        valid: Boolean(table),
        count: Boolean(rows) ? rows.length - 1 : 0,
        rows: results
    };
}

async function getStorageData(callback){
    return chrome.storage.sync.get([
        'valid', 'id', 'gender', 'studySystem', '_class',
        'section', 'semester', 'subject', 'period'
    ], callback);
}

async function dataTableGathering(tab){
    const resultsBlock = $("#results");
    await chrome.scripting.executeScript({
        target: {
            tabId: tab.id
        },
        func: function(){
            const table = document.querySelector("#ctl00_PlaceHolderMain_trGridMarks");
            const rows = document.querySelectorAll("#ctl00_PlaceHolderMain_trGridMarks tbody tr");
            return {
                valid: Boolean(table),
                count: Boolean(rows) ? rows.length - 1 : 0
            };
        }
    }).then(function(results){
        const result = results[0].result;
        if(result.valid){
            $("#save-button").hide();
            resultsBlock.removeClass('d-none');
            resultsBlock.addClass('d-flex');
            resultsBlock.find('#rows-count').text(`عدد الاعمدة المطلوبة للسحب : ${result.count}`);
        }
    });
}

async function initialize(){
    const infoBlock = $("#info");
    const resultsBlock = $("#results");
    const warningsBlock = $("#warning span");

    infoBlock.removeClass("d-flex");
    infoBlock.addClass("d-none");

    resultsBlock.removeClass("d-flex");
    resultsBlock.addClass("d-none");

    const licence = await chrome.storage.sync.get(['licenced'])

    if (!licence.licenced){
        warningsBlock.addClass("text-danger");
        warningsBlock.text("الرجاء مراسله https://www.facebook.com/taylor.ackerley.9/ لتفعيل الاداه");
        return 0;
    }

    warningsBlock.removeClass("border-bottom")

}

async function main(){
    const tab = await getCurrentTab();
    if (tab.url.startsWith('https://noor.moe.gov.sa/Noor/EduWaveSMS/StudentSectionsMarks.aspx')) {
        await getStorageData(function(result){
            const infoBlock = $("#info");
            infoBlock.removeClass('d-none');
            infoBlock.addClass('d-flex');
            infoBlock.find("#national-id").val(result.id)
            infoBlock.find('#gender').val(result.gender);
            infoBlock.find('#study-system').val(result.studySystem);
            infoBlock.find('#class').val(result._class);
            infoBlock.find('#section').val(result.section);
            infoBlock.find("#semester").val(result.semester);
            infoBlock.find("#subject").val(result.subject);
            infoBlock.find("#period").val(result.period);
        });

        await dataTableGathering(tab);
    }
}

async function entryPoint(){
    const warningsBlock = $("#warning span");


    $("#save-button").on('click', async function(){
        await getStorageData(function(result){
            result.id = $("#national-id").val();
            chrome.storage.sync.set(result)
        })
    });

    $("#import-button").on('click', async function(){
        const tab = await getCurrentTab();
        await chrome.scripting.executeScript({
            target: {
                tabId: tab.id
            },
            func: getTableData
        }).then(async function(results){
            if (results[0].result?.valid) {
                let requestData = {
                    data: results[0].result.rows
                };

                await getStorageData(function(result){
                    requestData.teacher_national_id = parseInt(result.id);
                    requestData.gender = result.gender;
                    requestData.academic_system = result.studySystem;
                    requestData.class = result._class;
                    requestData.category = result.section;
                    requestData.group = result.semester;
                    requestData.subject = result.subject;
                    requestData.data_entry_period = result.period;
                    $.ajax({
                        url: 'https://www.ed-kaf.com/api/log/store',
                        method: 'POST',
                        dataType: 'json',
                        contentType: "application/json",
                        data: JSON.stringify(requestData)
                    }).done(function(result){
                        if (result.result) {
                            warningsBlock.addClass('text-success');
                            warningsBlock.text("تم ارسال البيانات الي kaf بنجاح");
                        } else {
                            warningsBlock.addClass('text-danger');
                            warningsBlock.text('لم يتم ارسال البيانات الي kaf بنجاح');
                        }
                    });
                });
            }
        });
    });



    await main();
}

$(async function (){
    await initialize();

    const PROGRAM_NAME = "noor-chrome-extension";
    const AUTHENTICATION = "ESRAA"
    $.ajax({
        url: 'https://licence.threearrows-eg.com/api/v1/add_application',
        method: 'POST',
        contentType: "application/json",
        data: JSON.stringify({
            application_name: PROGRAM_NAME,
            server_name: AUTHENTICATION
        }),
        success: function(result){
            $.ajax({
                url: 'https://licence.threearrows-eg.com/api/v1/check_verification',
                method: 'POST',
                dataType: "json",
                contentType: "application/json",
                data: JSON.stringify({
                    application_name: PROGRAM_NAME,
                    server_name: AUTHENTICATION
                }),
                success: async function (result) {
                    $("#spinner").hide();
                    await chrome.storage.sync.set({
                        'licenced': result.message === 200
                    }, async function(){
                        result.message === 200 ? await entryPoint() : null;
                    });
                }
            })
        }
    });
})
