package friend

import (
	"net/http"

	"main/src/auth"
	"main/src/notify"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

type FriendController struct {
	Repo *Repository
}

func NewController(repo *Repository) *FriendController {
	return &FriendController{Repo: repo}
}

func (ctrl *FriendController) SendRequest(c *gin.Context) {
	var input struct {
		ToUserID string `json:"to_user_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	userIDValue, exists := c.Get(auth.UserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDValue.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user id"})
		return
	}

	fromObjID, err := bson.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	toObjID, err := bson.ObjectIDFromHex(input.ToUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid to_user_id"})
		return
	}

	if err := ctrl.Repo.SendRequest(fromObjID, toObjID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send friend request"})
		return
	}

	//gui notify cho nguoi nhan
	notify.SendToUser(toObjID.Hex(), "You have a new friend request!")

	c.JSON(http.StatusOK, gin.H{"message": "Request sent successfully"})
}

func (ctrl *FriendController) AcceptRequest(c *gin.Context) {
	var input struct {
		RequestID string `json:"request_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	requestID, err := bson.ObjectIDFromHex(input.RequestID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request_id"})
		return
	}

	if err := ctrl.Repo.AcceptRequest(requestID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept friend request"})
		return
	}

	req, err := ctrl.Repo.GetRequestByID(requestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get friend request"})
		return
	}

	notify.SendToUser(req.FromUserID.Hex(), "Your friend request has been accepted!")

	c.JSON(http.StatusOK, gin.H{"message": "Request accepted successfully"})
}

func (ctrl *FriendController) ListFriends(c *gin.Context) {
	userIDValue, exists := c.Get(auth.UserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDValue.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user id"})
		return
	}

	userObjID, err := bson.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	friends, err := ctrl.Repo.ListFriends(userObjID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load friend list"})
		return
	}

	friendIDs := make([]string, 0, len(friends))
	for _, id := range friends {
		friendIDs = append(friendIDs, id.Hex())
	}

	c.JSON(http.StatusOK, gin.H{"friends": friendIDs})
}

func (ctrl *FriendController) RefuseRequest(c *gin.Context) {
	var input struct {
		RequestID string `json:"request_id"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	requestID, err := bson.ObjectIDFromHex(input.RequestID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request_id"})
		return
	}

	if err := ctrl.Repo.RefuseRequest(requestID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to refuse friend request"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Friend request refused"})
}
