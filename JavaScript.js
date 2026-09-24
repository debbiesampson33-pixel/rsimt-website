
/* ==========================================
   RIGHT STEPS INCORPORATED
   MAIN JAVASCRIPT
========================================== */


/* ==========================================
   MOBILE MENU
========================================== */

const menuButton = document.querySelector(".menu-btn");
const navbar = document.querySelector(".navbar");

if (menuButton && navbar) {

    menuButton.addEventListener("click", function () {
        navbar.classList.toggle("show");
    });

}


/* ==========================================
   HOME HERO SLIDER
========================================== */

const homeHeroImages = [
    "myimages/homehero1.jpeg",
    "myimages/homehero2.jpeg"
];

let homeHeroIndex = 0;

const homeHeroImage =
    document.getElementById("homeHeroImage");

if (homeHeroImage && homeHeroImages.length > 1) {

    setInterval(function () {

        homeHeroImage.style.opacity = "0";

        setTimeout(function () {

            homeHeroIndex =
                (homeHeroIndex + 1) %
                homeHeroImages.length;

            homeHeroImage.src =
                homeHeroImages[homeHeroIndex];

            homeHeroImage.style.opacity = "1";

        }, 700);

    }, 5000);

}




/* ==========================================
   ABOUT US HERO SLIDER
========================================== */

const aboutHeroImages = [
    "myimages/aboutus1.png",
    "myimages/aboutus2.png"
];

let aboutHeroIndex = 0;

const aboutHeroImage =
    document.getElementById("aboutHeroImage");

if (aboutHeroImage && aboutHeroImages.length > 1) {

    setInterval(function () {

        /* Fade out */
        aboutHeroImage.style.opacity = "0";

        setTimeout(function () {

            /* Move to next image */
            aboutHeroIndex =
                (aboutHeroIndex + 1) %
                aboutHeroImages.length;

            /* Change image */
            aboutHeroImage.src =
                aboutHeroImages[aboutHeroIndex];

            /* Fade in */
            aboutHeroImage.style.opacity = "1";

        }, 700);

    }, 5000);

}
/* ==========================================
   RSCS GALLERY - AUTOMATIC SLIDER
========================================== */

document.addEventListener("DOMContentLoaded", function () {

    const track = document.getElementById("rscsGalleryTrack");

    if (!track) return;

    const slides =
        track.querySelectorAll(".rscs-gallery-slide");

    if (slides.length <= 1) return;

    let current = 0;

    function moveGallery() {

        current++;

        if (current >= slides.length) {
            current = 0;
        }

        track.style.transform =
            "translateX(-" + (current * 25) + "%)";
    }

    /* Start automatically */
    setInterval(moveGallery, 5000);

});

