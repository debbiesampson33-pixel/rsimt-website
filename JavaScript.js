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

    const track =
        document.getElementById("rscsGalleryTrack");

    if (!track) return;

    const gallerySlides =
        track.querySelectorAll(".rscs-gallery-slide");

    if (gallerySlides.length <= 1) return;

    let current = 0;

    function moveGallery() {

        current++;

        if (current >= gallerySlides.length) {
            current = 0;
        }

        track.style.transform =
            "translateX(-" + (current * 25) + "%)";
    }

    /* Start automatically */
    setInterval(moveGallery, 5000);

});


/* ==========================================
   HOME HERO SLIDER
========================================== */

const slides =
    document.querySelectorAll(".hero-slide");

let currentSlide = 0;

function showNextSlide() {

    /* Stop if there are not enough slides */
    if (slides.length < 2) return;

    slides[currentSlide].classList.remove("active");

    currentSlide =
        (currentSlide + 1) % slides.length;

    slides[currentSlide].classList.add("active");
}


/* Start hero slider */
if (slides.length > 1) {
    setInterval(showNextSlide, 4000);
}


/* ==========================================
   CONTACT FORM
========================================== */

const contactForm =
    document.getElementById("contactForm");

const formMessage =
    document.getElementById("formMessage");


/* Only run this code if the contact form
   actually exists on the current page */
if (contactForm && formMessage) {

    contactForm.addEventListener("submit", function (event) {

        event.preventDefault();


        const name =
            document.getElementById("name").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const message =
            document.getElementById("message").value.trim();


        if (!name || !email || !message) {

            formMessage.textContent =
                "Please fill in all the fields.";

            formMessage.style.color =
                "#b00020";

            return;
        }


        formMessage.textContent =
            "Thank you, " + name +
            ". Your message has been prepared successfully.";

        formMessage.style.color =
            "#087f3f";


        contactForm.reset();

    });

}