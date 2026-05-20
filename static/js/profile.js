document.addEventListener("DOMContentLoaded", function () {

const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
    tab.addEventListener("click", () => {

        tabs.forEach(t => t.classList.remove("active"));
        contents.forEach(c => c.classList.remove("active"));

        tab.classList.add("active");

        const target = tab.dataset.tab;
        document.getElementById(target + "Tab").classList.add("active");
    });
});


/* Edit profile modal */

const editBtn = document.getElementById("editProfileBtn");
const editModal = document.getElementById("editProfileModal");

if (editBtn) {
    editBtn.onclick = () => editModal.style.display = "flex";
}

const closeEdit = document.getElementById("closeEditModal");
if (closeEdit) {
    closeEdit.onclick = () => editModal.style.display = "none";
}


/* followers modal */

const followersBtn = document.getElementById("followersBtn");
const followModal = document.getElementById("followModal");

if (followersBtn) {
    followersBtn.onclick = () => followModal.style.display = "flex";
}

const closeFollow = document.getElementById("closeFollowModal");
if (closeFollow) {
    closeFollow.onclick = () => followModal.style.display = "none";
}


/* post modal */

const postModal = document.getElementById("postModal");
const closePostModal = document.getElementById("closePostModal");

if (closePostModal) {
    closePostModal.onclick = () => postModal.style.display = "none";
}


/* booking modal */

const bookingBtn = document.getElementById("bookAppointmentBtn");
const bookingModal = document.getElementById("bookingModal");

if (bookingBtn) {
    bookingBtn.onclick = () => bookingModal.style.display = "flex";
}

const closeBooking = document.getElementById("closeBookingModal");
if (closeBooking) {
    closeBooking.onclick = () => bookingModal.style.display = "none";
}


/* review modal */

const reviewBtn = document.getElementById("writeReviewBtn");
const reviewModal = document.getElementById("reviewModal");

if (reviewBtn) {
    reviewBtn.onclick = () => reviewModal.style.display = "flex";
}

const closeReview = document.getElementById("closeReviewModal");
if (closeReview) {
    closeReview.onclick = () => reviewModal.style.display = "none";
}


/* star rating */

const stars = document.querySelectorAll("#reviewStars i");

stars.forEach(star => {
    star.addEventListener("click", () => {

        const value = star.dataset.value;

        stars.forEach(s => s.classList.remove("fas"));
        stars.forEach(s => s.classList.add("far"));

        for (let i = 0; i < value; i++) {
            stars[i].classList.remove("far");
            stars[i].classList.add("fas");
        }
    });
});

});
