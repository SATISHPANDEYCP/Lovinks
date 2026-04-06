import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { Camera, Mail, User, X } from "lucide-react";
import toast from "react-hot-toast";

const MAX_PROFILE_PIC_SIZE_BYTES = 5 * 1024 * 1024;

const ProfilePage = () => {
  const navigate = useNavigate();
  const { authUser, isUpdatingProfile, isDeletingAccount, updateProfile, deleteAccount } =
    useAuthStore();
  const [selectedImg, setSelectedImg] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_PROFILE_PIC_SIZE_BYTES) {
      toast.error("Image size must be 5MB or less");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      toast.error("Password is required to delete account");
      return;
    }

    await deleteAccount(deletePassword);
    setDeletePassword("");
    setShowDeleteModal(false);
  };

  const openDeleteModal = () => {
    setDeletePassword("");
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    if (isDeletingAccount) return;
    setDeletePassword("");
    setShowDeleteModal(false);
  };

  return (
    <div className="min-h-screen pt-20">
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="bg-base-300 rounded-xl p-4 sm:p-5 space-y-5">
          <div className="relative text-center">
            <button
              type="button"
              className="btn btn-circle btn-sm absolute -top-1 right-0"
              aria-label="Close profile"
              onClick={() => navigate("/")}
            >
              <X className="size-4" />
            </button>
            <h1 className="text-xl font-semibold">Profile</h1>
            <p className="mt-1 text-sm text-base-content/70">Your profile information</p>
          </div>

          {/* avatar upload section */}

          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <img
                src={selectedImg || authUser.profilePic || "/avatar.png"}
                alt="Profile"
                className="size-24 rounded-full object-cover border-2"
              />
              <label
                htmlFor="avatar-upload"
                className={`
                  absolute bottom-0 right-0 
                  bg-base-content hover:scale-105
                  p-1.5 rounded-full cursor-pointer 
                  transition-all duration-200
                  ${isUpdatingProfile ? "animate-pulse pointer-events-none" : ""}
                `}
              >
                <Camera className="w-4 h-4 text-base-200" />
                <input
                  type="file"
                  id="avatar-upload"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUpdatingProfile}
                />
              </label>
            </div>
            <p className="text-xs text-base-content/70 text-center">
              {isUpdatingProfile ? "Uploading..." : "Click the camera icon to update your photo"}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="text-xs text-base-content/70 flex items-center gap-2">
                <User className="w-4 h-4" />
                Full Name
              </div>
              <p className="px-3 py-2 bg-base-200 rounded-lg border text-sm">{authUser?.fullName}</p>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-base-content/70 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </div>
              <p className="px-3 py-2 bg-base-200 rounded-lg border text-sm">{authUser?.email}</p>
            </div>
          </div>

          <div className="rounded-lg border border-base-200 p-3 bg-base-200/40">
            <h2 className="text-sm font-medium mb-2">Account Information</h2>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-base-300">
                <span>Member Since</span>
                <span>{authUser.createdAt?.split("T")[0]}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span>Account Status</span>
                <span className="text-green-500">Active</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-red-500/35 p-3 bg-red-500/5">
            <h2 className="text-sm font-medium text-red-400">Danger Zone</h2>
            <p className="mt-1 text-xs sm:text-sm text-base-content/75">
              Deleting your account will permanently remove your profile, chats, and uploaded media.
            </p>
            <button
              type="button"
              onClick={openDeleteModal}
              disabled={isDeletingAccount}
              className="btn btn-sm mt-3 border-red-500/45 text-red-400 hover:bg-red-500/10"
            >
              {isDeletingAccount ? "Deleting..." : "Delete Account Permanently"}
            </button>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close delete account dialog"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={closeDeleteModal}
          />

          <div className="relative w-full max-w-md rounded-xl border border-red-500/35 bg-base-100 p-5 shadow-2xl">
            <button
              type="button"
              className="btn btn-circle btn-sm absolute top-2 right-2"
              aria-label="Close delete account dialog"
              onClick={closeDeleteModal}
              disabled={isDeletingAccount}
            >
              <X className="size-4" />
            </button>
            <h3 className="text-lg font-semibold text-red-400">Delete Account</h3>
            <p className="mt-2 text-sm text-base-content/75">
              This action is permanent. Your profile, chats, and media will be deleted forever.
            </p>

            <div className="mt-4">
              <label className="label">
                <span className="label-text font-medium">Confirm your password</span>
              </label>
              <input
                type="password"
                className="input input-bordered w-full"
                placeholder="Enter password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                autoFocus
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn btn-sm"
                onClick={closeDeleteModal}
                disabled={isDeletingAccount}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm border-red-500/45 text-red-400 hover:bg-red-500/10"
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ProfilePage;
