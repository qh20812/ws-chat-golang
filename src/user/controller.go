package user

import (
	"main/src/common"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Controller struct {
	Repo *Repository
}

func NewController(repo *Repository) *Controller {
	return &Controller{Repo: repo}
}

func (ctrl Controller) Register(ctx *gin.Context) {
	var input User
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input!"})
		return
	}

	hashedPassword, err := common.HashPassword(input.Password)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password!"})
		return
	}
	input.Password = hashedPassword

	if err := ctrl.Repo.Create(&input); err != nil {
		ctx.JSON(http.StatusConflict, gin.H{"error": "Username or Email exists!"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "Register successfully!"})
}

func (ctrl *Controller) UpdateUser(c *gin.Context) {
	userIDValue, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userIDStr, ok := userIDValue.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user id"})
		return
	}

	userObjID, err := bson.ObjectIDFromHex(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user id"})
		return
	}

	var input struct {
		Username *string `json:"username"`
		Email    *string `json:"email"`
		Password *string `json:"password"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	update := bson.M{}
	if input.Username != nil {
		update["username"] = *input.Username
	}
	if input.Email != nil {
		update["email"] = *input.Email
	}
	if input.Password != nil {
		hashed, err := common.HashPassword(*input.Password)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		update["password"] = hashed
	}

	if len(update) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	if err := ctrl.Repo.UpdateUser(userObjID, update); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated successfully"})
}

func (ctrl *Controller) SearchUser(c *gin.Context) {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query cannot be empty"})
		return
	}

	user, err := ctrl.Repo.FindByUsernameOrEmail(query)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": gin.H{"id": user.ID.Hex(), "username": user.Username, "email": user.Email}})
}
