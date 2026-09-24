document.addEventListener("DOMContentLoaded", function () {
    const form = document.querySelector("form");

    if (!form) return;

    form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const studentId = form.querySelector("input").value.trim();
        const selects = form.querySelectorAll("select");

        const semester = selects[0]?.value || "";
        const session = selects[1]?.value || "";

        if (!studentId) {
            alert("Please enter your Student ID.");
            return;
        }

        try {
            const response = await fetch(
                "/api/student/" + encodeURIComponent(studentId) + "/results"
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "Student not found.");
                return;
            }

const results = data.filter(function (result) {
                const resultSemester = result.semester
                    .toLowerCase()
                    .replace(" semester", "");

                const selectedSemester = semester
                    .toLowerCase()
                    .replace(" semester", "");

                return (
                    resultSemester === selectedSemester &&
                    result.session === session
                );
            });

            let oldResults = document.getElementById("result-checker-output");
            if (oldResults) oldResults.remove();

            const output = document.createElement("div");
            output.id = "result-checker-output";
            output.style.marginTop = "30px";

            if (results.length === 0) {
                output.innerHTML = "<h3>No results found for this session and semester.</h3>";
            } else {
                let html = "<h2>Academic Results</h2>";
                html += "<table style='width:100%; border-collapse:collapse; margin-top:20px'>";
                html += "<tr><th style='padding:12px; text-align:left'>Course</th>";
                html += "<th style='padding:12px; text-align:left'>Score</th>";
                html += "<th style='padding:12px; text-align:left'>Grade</th></tr>";

                results.forEach(function (result) {
                    html += `
                        <tr>
                            <td style="padding:12px; border-top:1px solid #ddd">
                                ${result.course}
                            </td>
                            <td style="padding:12px; border-top:1px solid #ddd">
                                ${result.score}
                            </td>
                            <td style="padding:12px; border-top:1px solid #ddd">
                                ${result.grade}
                            </td>
                        </tr>
                    `;
                });

                html += "</table>";
                output.innerHTML = html;
            }

            form.parentElement.appendChild(output);

        } catch (error) {
            alert("Could not connect to the result system.");
            console.error(error);
        }
    });
});