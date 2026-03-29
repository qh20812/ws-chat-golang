package notify

import (

	"go.mongodb.org/mongo-driver/v2/mongo"
)

type Repository struct {
	Collection *mongo.Collection
}

func NewRepository(db *mongo.Database) *Repository {
	return &Repository{
		Collection: db.Collection("notifications"),
	}
}

